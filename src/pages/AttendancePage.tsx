import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, History } from 'lucide-react';
import { FeedbackBanner, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { AttendanceStatus } from '../types/erp';

interface AttendancePayload {
  thresholdPct: number;
  sessions: {
    id: string;
    subjectId: string;
    subjectCode: string;
    subjectTitle: string;
    sectionId: string;
    sectionName: string;
    date: string;
    period: number;
    topicCovered: string;
    submittedBy: string;
    records: { studentId: string; status: AttendanceStatus }[];
  }[];
  studentSummary: {
    studentId: string;
    registerNumber: string;
    fullName: string;
    sectionId: string;
    sectionName: string;
    total: number;
    attended: number;
    onDuty: number;
    absent: number;
    percentage: number;
  }[];
  corrections: {
    id: string;
    sessionId: string;
    studentName: string;
    registerNumber: string;
    subjectCode: string;
    date: string;
    currentStatus: AttendanceStatus;
    requestedStatus: AttendanceStatus;
    reason: string;
    requestedByName: string;
    status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  }[];
}

export function AttendancePage() {
  const { user, selectedDepartmentId, can } = useAuth();
  const [data, setData] = useState<AttendancePayload | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; code: string; title: string; sectionId: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; registerNumber: string; fullName: string; sectionId: string }[]>([]);

  const [markSubjectId, setMarkSubjectId] = useState('sub-cs3502');
  const [markSectionId, setMarkSectionId] = useState('sec-5a');
  const [markDate, setMarkDate] = useState('2026-11-13');
  const [markPeriod, setMarkPeriod] = useState(1);
  const [markTopic, setMarkTopic] = useState('Regularization & Cross-Validation');
  const [markMap, setMarkMap] = useState<Record<string, AttendanceStatus>>({});

  const [corrSessionId, setCorrSessionId] = useState('');
  const [corrStatus, setCorrStatus] = useState<AttendanceStatus>('ON_DUTY');
  const [corrReason, setCorrReason] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isStudent = user?.roles.includes('STUDENT');

  const loadAttendance = useCallback(async () => {
    try {
      const [attRes, strRes, stuRes] = await Promise.all([
        apiRequest<AttendancePayload>(`/attendance?departmentId=${encodeURIComponent(selectedDepartmentId)}`),
        apiRequest<{ subjects: { id: string; code: string; title: string; sectionId: string }[]; sections: { id: string; name: string }[] }>(
          `/academics/structure?departmentId=${encodeURIComponent(selectedDepartmentId)}`
        ),
        apiRequest<{ students: { id: string; registerNumber: string; fullName: string; sectionId: string }[] }>(
          `/students?departmentId=${encodeURIComponent(selectedDepartmentId)}`
        ),
      ]);
      setData(attRes);
      setSubjects(strRes.subjects);
      setSections(strRes.sections);
      setStudents(stuRes.students);
      if (attRes.sessions.length && !corrSessionId) {
        setCorrSessionId(attRes.sessions[0].id);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load attendance' });
    }
  }, [selectedDepartmentId, corrSessionId]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const classStudents = students.filter((s) => s.sectionId === markSectionId);

  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const records = classStudents.map((st) => ({
        studentId: st.id,
        status: markMap[st.id] || 'PRESENT',
      }));
      await apiRequest('/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: markSubjectId,
          sectionId: markSectionId,
          date: markDate,
          period: markPeriod,
          topicCovered: markTopic,
          records,
        }),
      });
      setFeedback({
        type: 'success',
        message: `Submitted attendance for ${classStudents.length} students on ${markDate} (Period ${markPeriod}).`,
      });
      await loadAttendance();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Submission failed' });
    }
  };

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiRequest('/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: corrSessionId,
          studentId: user?.studentId,
          requestedStatus: corrStatus,
          reason: corrReason,
        }),
      });
      setCorrReason('');
      setFeedback({ type: 'success', message: 'Correction request submitted for HOD/Advisor review.' });
      await loadAttendance();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to submit correction' });
    }
  };

  const handleCorrectionDecision = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setFeedback(null);
    try {
      await apiRequest(`/attendance/corrections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, comment: `${decision} via Attendance Governance` }),
      });
      setFeedback({ type: 'success', message: `Correction request ${decision.toLowerCase()} and register updated.` });
      await loadAttendance();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Action failed' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Attendance Management & Shortage Compliance"
        subtitle={`Real-time session registers, ${data?.thresholdPct ?? 75}% policy monitoring, and audited correction workflows`}
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {/* Faculty Attendance Entry Panel */}
      {!isStudent && can('attendance', 'create') && (
        <form onSubmit={handleSubmitAttendance} className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">Daily Class Attendance Entry</h2>
            </div>
            <span className="text-xs text-slate-500">Duplicate session submissions are blocked automatically</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <select
              value={markSubjectId}
              onChange={(e) => setMarkSubjectId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} · {sub.title}
                </option>
              ))}
            </select>
            <select
              value={markSectionId}
              onChange={(e) => setMarkSectionId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={markDate}
              onChange={(e) => setMarkDate(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs"
            />
            <select
              value={markPeriod}
              onChange={(e) => setMarkPeriod(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>Period {p}</option>
              ))}
            </select>
            <input
              type="text"
              value={markTopic}
              onChange={(e) => setMarkTopic(e.target.value)}
              placeholder="Topic covered"
              className="rounded-md border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          {classStudents.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">No students enrolled in selected section.</p>
          ) : (
            <div className="border border-slate-200 rounded-md overflow-hidden mb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="py-2 px-4">Register No</th>
                    <th className="py-2 px-4">Student Name</th>
                    <th className="py-2 px-4">Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {classStudents.map((st) => {
                    const current = markMap[st.id] || 'PRESENT';
                    return (
                      <tr key={st.id}>
                        <td className="py-2.5 px-4 font-mono text-slate-700">{st.registerNumber}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{st.fullName}</td>
                        <td className="py-2.5 px-4">
                          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                            {(['PRESENT', 'ABSENT', 'ON_DUTY'] as AttendanceStatus[]).map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => setMarkMap((prev) => ({ ...prev, [st.id]: status }))}
                                className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                                  current === status
                                    ? status === 'ABSENT'
                                      ? 'bg-red-600 text-white'
                                      : status === 'ON_DUTY'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-emerald-700 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {status === 'ON_DUTY' ? 'On Duty' : status === 'PRESENT' ? 'Present' : 'Absent'}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={classStudents.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Submit Attendance Register
            </button>
          </div>
        </form>
      )}

      {/* Student Summary Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">
          {isStudent ? 'My Cumulative Attendance Summary' : 'Student-Wise Attendance & Shortage Register'}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          On-Duty sessions count toward attended hours per institution policy ({data?.thresholdPct ?? 75}% minimum)
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-4">Register No</th>
                <th className="py-2.5 px-3">Student</th>
                <th className="py-2.5 px-3">Section</th>
                <th className="py-2.5 px-3 text-right">Attended</th>
                <th className="py-2.5 px-3 text-right">On-Duty</th>
                <th className="py-2.5 px-3 text-right">Absent</th>
                <th className="py-2.5 px-3 text-right">Percentage</th>
                <th className="py-2.5 pl-3">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {(data?.studentSummary || []).map((row) => {
                const shortage = row.total > 0 && row.percentage < (data?.thresholdPct ?? 75);
                return (
                  <tr key={row.studentId} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-mono text-slate-700">{row.registerNumber}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{row.fullName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{row.sectionName}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{row.attended}/{row.total}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{row.onDuty}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{row.absent}</td>
                    <td className={`py-2.5 px-3 text-right font-mono tabular-nums font-semibold ${shortage ? 'text-red-700' : 'text-slate-900'}`}>
                      {row.percentage}%
                    </td>
                    <td className="py-2.5 pl-3">
                      <StatusLabel status={shortage ? 'HIGH_RISK' : 'NOMINAL'} label={shortage ? 'Shortage' : 'Compliant'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correction Workflow & Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Attendance Correction Requests</h2>
          </div>

          {isStudent && (
            <form onSubmit={handleRequestCorrection} className="bg-slate-50 border border-slate-200 rounded-md p-3.5 mb-4 space-y-2.5">
              <div className="text-xs font-medium text-slate-800">Request Session Correction</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={corrSessionId}
                  onChange={(e) => setCorrSessionId(e.target.value)}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {(data?.sessions || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.date} · {s.subjectCode} (P{s.period})
                    </option>
                  ))}
                </select>
                <select
                  value={corrStatus}
                  onChange={(e) => setCorrStatus(e.target.value as AttendanceStatus)}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="ON_DUTY">Change to On-Duty</option>
                  <option value="PRESENT">Change to Present</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  placeholder="Provide reason / OD reference number..."
                  className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-blue-700 text-white text-xs font-medium cursor-pointer"
                >
                  Submit
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-slate-100">
            {(data?.corrections || []).length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No attendance correction requests.</p>
            ) : (
              (data?.corrections || []).map((c) => (
                <div key={c.id} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-900">
                      {c.registerNumber} · {c.studentName}
                    </span>
                    <StatusLabel status={c.status} />
                  </div>
                  <div className="text-xs text-slate-600">
                    {c.subjectCode} on {c.date}: <span className="font-mono">{c.currentStatus} → {c.requestedStatus}</span>
                  </div>
                  <p className="text-xs text-slate-500">{c.reason}</p>
                  {c.status === 'SUBMITTED' && can('attendance', 'approve') && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCorrectionDecision(c.id, 'APPROVED')}
                        className="px-2.5 py-1 rounded bg-emerald-700 text-white text-[11px] font-medium cursor-pointer"
                      >
                        Approve &amp; Update Register
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCorrectionDecision(c.id, 'REJECTED')}
                        className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 text-[11px] font-medium cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Submitted Sessions */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Recent Submitted Registers</h2>
          <div className="divide-y divide-slate-100">
            {(data?.sessions || []).slice(0, 6).map((sess) => {
              const presentCount = sess.records.filter((r) => r.status !== 'ABSENT').length;
              return (
                <div key={sess.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {sess.subjectCode} · {sess.topicCovered}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {sess.date} · Period {sess.period} · {sess.sectionName} · by {sess.submittedBy}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-slate-700 shrink-0">
                    {presentCount}/{sess.records.length}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
