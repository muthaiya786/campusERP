import React, { useCallback, useEffect, useState } from 'react';
import { Briefcase, Calendar, FlaskConical, FolderKanban, ShieldCheck } from 'lucide-react';
import { FeedbackBanner, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface OperationsPayload {
  projects: {
    id: string;
    title: string;
    category: string;
    technologyStack: string;
    guideName: string;
    teamNames: string[];
    milestoneProgressPct: number;
    latestReviewMarks: number;
    status: string;
  }[];
  internships: {
    id: string;
    studentName: string;
    registerNumber: string;
    companyName: string;
    roleTitle: string;
    mode: string;
    startDate: string;
    endDate: string;
    stipendInr: number;
    status: string;
  }[];
  jobOpenings: {
    id: string;
    companyName: string;
    roleTitle: string;
    packageLpa: number;
    minCgpa: number;
    driveDate: string;
    location: string;
    applicantStudentIds: string[];
    selectedStudentIds: string[];
    status: string;
  }[];
  events: {
    id: string;
    title: string;
    category: string;
    coordinatorName: string;
    resourcePerson: string;
    eventDate: string;
    venue: string;
    budgetInr: number;
    status: string;
    registeredCount: number;
    isRegistered: boolean;
  }[];
  publications: {
    id: string;
    title: string;
    authors: string;
    facultyName: string;
    journalOrConference: string;
    indexing: string;
    year: number;
    doi: string;
    verified: boolean;
  }[];
  accreditationEvidence: {
    id: string;
    framework: string;
    criterionCode: string;
    criterionTitle: string;
    ownerName: string;
    documentTitle: string;
    completionPct: number;
    status: string;
    reviewerNotes?: string;
    updatedAt: string;
  }[];
  labAssets: {
    id: string;
    labName: string;
    roomCode: string;
    inChargeName: string;
    assetCode: string;
    equipmentName: string;
    quantity: number;
    warrantyUntil: string;
    condition: string;
    maintenanceTicketStatus: string;
  }[];
  mentorMeetings: {
    id: string;
    mentorName: string;
    studentName: string;
    meetingDate: string;
    summary: string;
    actionItem: string;
    followUpStatus: string;
  }[];
}

export function OperationsPage() {
  const { user, selectedDepartmentId, can } = useAuth();
  const [subTab, setSubTab] = useState<'projects' | 'placements' | 'events' | 'iqac' | 'labs'>('projects');
  const [data, setData] = useState<OperationsPayload | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isStudent = user?.roles.includes('STUDENT');

  const loadOps = useCallback(async () => {
    try {
      const res = await apiRequest<OperationsPayload>(
        `/operations/overview?departmentId=${encodeURIComponent(selectedDepartmentId)}`
      );
      setData(res);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load operations' });
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    void loadOps();
  }, [loadOps]);

  const handleRegisterEvent = async (id: string) => {
    try {
      await apiRequest(`/operations/events/${id}/register`, { method: 'POST' });
      setFeedback({ type: 'success', message: 'Registered for department event.' });
      await loadOps();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Registration failed' });
    }
  };

  const handleApproveEvent = async (id: string) => {
    try {
      await apiRequest(`/operations/events/${id}/approve`, { method: 'PATCH' });
      setFeedback({ type: 'success', message: 'Event proposal approved for calendar publication.' });
      await loadOps();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Approval failed' });
    }
  };

  const handleApplyJob = async (id: string) => {
    try {
      await apiRequest(`/operations/jobs/${id}/apply`, { method: 'POST' });
      setFeedback({ type: 'success', message: 'Placement application submitted after CGPA eligibility check.' });
      await loadOps();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Application failed' });
    }
  };

  const handleVerifyIqac = async (id: string, status: 'VERIFIED' | 'NEEDS_REVISION') => {
    try {
      await apiRequest(`/operations/iqac/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reviewerNotes: status === 'VERIFIED' ? 'Verified against department repository.' : 'Please upload signed annexure.',
        }),
      });
      setFeedback({ type: 'success', message: `Accreditation evidence marked ${status.toLowerCase()}.` });
      await loadOps();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Verification failed' });
    }
  };

  const handleLabMaintenance = async (
    id: string,
    condition: 'OPERATIONAL' | 'MAINTENANCE_DUE',
    maintenanceTicketStatus: 'NONE' | 'OPEN' | 'RESOLVED'
  ) => {
    try {
      await apiRequest(`/operations/labs/${id}/maintenance`, {
        method: 'PATCH',
        body: JSON.stringify({ condition, maintenanceTicketStatus }),
      });
      setFeedback({ type: 'success', message: 'Lab asset maintenance status updated.' });
      await loadOps();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Update failed' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Department Operations, Placements, IQAC & Labs"
        subtitle="Projects, mentoring, internships, campus drives, workshops, research, accreditation & laboratory assets"
        actions={
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'projects', label: 'Projects & Mentoring', icon: FolderKanban },
              { id: 'placements', label: 'Placements & Internships', icon: Briefcase },
              { id: 'events', label: 'Events & Research', icon: Calendar },
              { id: 'iqac', label: 'IQAC / NAAC / NBA', icon: ShieldCheck },
              { id: 'labs', label: 'Labs & Assets', icon: FlaskConical },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSubTab(item.id as typeof subTab)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                    subTab === item.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        }
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {!data ? (
        <div className="h-40 bg-white border border-slate-200 rounded-lg animate-pulse" />
      ) : (
        <>
          {subTab === 'projects' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Student Capstone &amp; Funded Projects</h2>
                <div className="space-y-4">
                  {data.projects.map((p) => (
                    <div key={p.id} className="border border-slate-200 rounded-md p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-blue-700">{p.category} · Guide: {p.guideName}</span>
                        <StatusLabel status={p.status} />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mt-1">{p.title}</h3>
                      <div className="text-xs text-slate-500 mt-1">
                        Stack: {p.technologyStack} · Team: {p.teamNames.join(', ')}
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                          <div className="h-full bg-blue-700" style={{ width: `${p.milestoneProgressPct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-slate-700">
                          {p.milestoneProgressPct}% · Review {p.latestReviewMarks}/50
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Faculty-Student Mentoring Log</h2>
                <div className="divide-y divide-slate-100">
                  {data.mentorMeetings.map((m) => (
                    <div key={m.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-900">
                          {m.studentName} <span className="text-slate-400">· Mentor:</span> {m.mentorName}
                        </span>
                        <span className="font-mono text-slate-500">{m.meetingDate}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{m.summary}</p>
                      <div className="text-[11px] text-blue-700 mt-1">Action: {m.actionItem}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {subTab === 'placements' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Campus Placement Drives</h2>
                <div className="space-y-3">
                  {data.jobOpenings.map((job) => {
                    const applied = user?.studentId && job.applicantStudentIds.includes(user.studentId);
                    return (
                      <div key={job.id} className="border border-slate-200 rounded-md p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{job.companyName}</span>
                          <span className="font-mono text-xs font-semibold text-emerald-700">{job.packageLpa} LPA</span>
                        </div>
                        <div className="text-xs text-slate-700 mt-0.5">{job.roleTitle} · {job.location}</div>
                        <div className="text-[11px] text-slate-500 mt-1 font-mono">
                          Drive: {job.driveDate} · Min CGPA: {job.minCgpa} · Applicants: {job.applicantStudentIds.length} · Selected: {job.selectedStudentIds.length}
                        </div>
                        {isStudent && job.status === 'OPEN' && (
                          <div className="mt-3">
                            {applied ? (
                              <StatusLabel status="VERIFIED" label="Applied" />
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApplyJob(job.id)}
                                className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
                              >
                                Apply Now
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Student Industrial Internships</h2>
                <div className="divide-y divide-slate-100 text-xs">
                  {data.internships.map((i) => (
                    <div key={i.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">
                          {i.registerNumber} · {i.studentName}
                        </span>
                        <StatusLabel status={i.status} />
                      </div>
                      <div className="text-slate-700 mt-0.5">{i.companyName} — {i.roleTitle}</div>
                      <div className="text-slate-500 font-mono mt-0.5">
                        {i.startDate} to {i.endDate} · {i.mode} · Stipend ₹{i.stipendInr.toLocaleString('en-IN')}/mo
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {subTab === 'events' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Workshops, FDPs &amp; Symposiums</h2>
                <div className="space-y-3">
                  {data.events.map((evt) => (
                    <div key={evt.id} className="border border-slate-200 rounded-md p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-blue-700">{evt.category} · {evt.eventDate}</span>
                        <StatusLabel status={evt.status} />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mt-1">{evt.title}</h3>
                      <div className="text-xs text-slate-500 mt-1">
                        Resource: {evt.resourcePerson} · Venue: {evt.venue} · Registered: {evt.registeredCount}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {evt.status === 'APPROVED' && (
                          <button
                            type="button"
                            disabled={evt.isRegistered}
                            onClick={() => handleRegisterEvent(evt.id)}
                            className="px-3 py-1 rounded border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                          >
                            {evt.isRegistered ? 'Registered' : 'Register'}
                          </button>
                        )}
                        {evt.status === 'PROPOSED' && can('operations', 'approve') && (
                          <button
                            type="button"
                            onClick={() => handleApproveEvent(evt.id)}
                            className="px-3 py-1 rounded bg-emerald-700 text-white text-xs font-medium cursor-pointer"
                          >
                            Approve Proposal
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Faculty Research Publications</h2>
                <div className="divide-y divide-slate-100 text-xs">
                  {data.publications.map((pub) => (
                    <div key={pub.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-blue-700">{pub.indexing} · {pub.year}</span>
                        <StatusLabel status={pub.verified ? 'VERIFIED' : 'PENDING'} />
                      </div>
                      <div className="font-medium text-slate-900 mt-1">{pub.title}</div>
                      <div className="text-slate-600 mt-0.5">{pub.authors}</div>
                      <div className="text-slate-500 mt-0.5 font-mono">
                        {pub.journalOrConference} · DOI: {pub.doi}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {subTab === 'iqac' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Accreditation &amp; IQAC Evidence Documentation
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Documentation and verification tracker for NAAC/NBA criteria (institution coordinators validate official compliance)
                </p>
              </div>
              <div className="space-y-4">
                {data.accreditationEvidence.map((item) => (
                  <div key={item.id} className="border border-slate-200 rounded-md p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono text-blue-700">
                          {item.framework} {item.criterionCode} · Owner: {item.ownerName}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{item.criterionTitle}</h3>
                        <p className="text-xs text-slate-600 mt-1">{item.documentTitle}</p>
                        {item.reviewerNotes && (
                          <p className="text-xs text-amber-800 mt-1">Reviewer Note: {item.reviewerNotes}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusLabel status={item.status} />
                        {can('operations', 'verify') && item.status !== 'VERIFIED' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleVerifyIqac(item.id, 'VERIFIED')}
                              className="px-3 py-1 rounded bg-emerald-700 text-white text-xs font-medium cursor-pointer"
                            >
                              Verify Evidence
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVerifyIqac(item.id, 'NEEDS_REVISION')}
                              className="px-3 py-1 rounded border border-slate-300 text-slate-700 text-xs font-medium cursor-pointer"
                            >
                              Request Revision
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === 'labs' && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <th className="py-3 px-4">Asset Code</th>
                      <th className="py-3 px-4">Laboratory &amp; Equipment</th>
                      <th className="py-3 px-4">In-Charge</th>
                      <th className="py-3 px-4 text-right">Qty</th>
                      <th className="py-3 px-4">Condition</th>
                      <th className="py-3 px-4">Maintenance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {data.labAssets.map((lab) => (
                      <tr key={lab.id}>
                        <td className="py-3 px-4 font-mono text-slate-700">{lab.assetCode}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{lab.equipmentName}</div>
                          <div className="text-slate-500">{lab.labName} ({lab.roomCode}) · Warranty {lab.warrantyUntil}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{lab.inChargeName}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{lab.quantity}</td>
                        <td className="py-3 px-4">
                          <StatusLabel status={lab.condition} />
                        </td>
                        <td className="py-3 px-4">
                          {can('operations', 'edit') && !isStudent ? (
                            lab.condition === 'OPERATIONAL' ? (
                              <button
                                type="button"
                                onClick={() => handleLabMaintenance(lab.id, 'MAINTENANCE_DUE', 'OPEN')}
                                className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-medium cursor-pointer"
                              >
                                Log Maintenance Ticket
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleLabMaintenance(lab.id, 'OPERATIONAL', 'RESOLVED')}
                                className="px-2.5 py-1 rounded bg-emerald-700 text-white text-[11px] font-medium cursor-pointer"
                              >
                                Mark Resolved
                              </button>
                            )
                          ) : (
                            <span className="text-slate-500">{lab.maintenanceTicketStatus}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
