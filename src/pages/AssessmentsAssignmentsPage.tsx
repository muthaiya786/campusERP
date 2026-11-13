import React, { useCallback, useEffect, useState } from 'react';
import { Award, BookMarked, CheckCircle2, FileText, Plus, Send } from 'lucide-react';
import { FeedbackBanner, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface AssessmentItem {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
  sectionName: string;
  title: string;
  componentType: string;
  maxMarks: number;
  passMarks: number;
  examDate: string;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'PUBLISHED';
  publishedAt?: string;
  publishedBy?: string;
  marks: {
    studentId: string;
    registerNumber?: string;
    studentName?: string;
    scoredMarks: number;
    remarks?: string;
  }[];
}

interface AssignmentItem {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
  sectionName: string;
  facultyName: string;
  title: string;
  instructions: string;
  maxMarks: number;
  dueDate: string;
  submissions: {
    id: string;
    studentId: string;
    studentName?: string;
    registerNumber?: string;
    submittedAt: string;
    fileName: string;
    notes: string;
    marks?: number;
    feedback?: string;
    status: string;
  }[];
}

interface MaterialItem {
  id: string;
  subjectCode: string;
  title: string;
  unitNumber: number;
  resourceType: string;
  uploadedByName: string;
  uploadedAt: string;
}

export function AssessmentsAssignmentsPage({ initialTab = 'assessments' }: { initialTab?: 'assessments' | 'assignments' }) {
  const { user, selectedDepartmentId, can } = useAuth();
  const [tab, setTab] = useState<'assessments' | 'assignments'>(initialTab);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; code: string; title: string; sectionId: string }[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [editedMarks, setEditedMarks] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Assignment form
  const [showAsgForm, setShowAsgForm] = useState(false);
  const [asgForm, setAsgForm] = useState({ subjectId: '', title: '', instructions: '', maxMarks: 25, dueDate: '2026-11-25' });

  // Student submit note
  const [submitFile, setSubmitFile] = useState<Record<string, string>>({});
  const [gradeInputs, setGradeInputs] = useState<Record<string, { marks: number; feedback: string }>>({});

  const isStudent = user?.roles.includes('STUDENT');

  const loadAll = useCallback(async () => {
    try {
      const [asmRes, asgRes, strRes] = await Promise.all([
        apiRequest<{ assessments: AssessmentItem[] }>(`/assessments?departmentId=${encodeURIComponent(selectedDepartmentId)}`),
        apiRequest<{ assignments: AssignmentItem[]; materials: MaterialItem[] }>(`/assignments?departmentId=${encodeURIComponent(selectedDepartmentId)}`),
        apiRequest<{ subjects: { id: string; code: string; title: string; sectionId: string }[] }>(`/academics/structure?departmentId=${encodeURIComponent(selectedDepartmentId)}`),
      ]);
      setAssessments(asmRes.assessments);
      setAssignments(asgRes.assignments);
      setMaterials(asgRes.materials);
      setSubjects(strRes.subjects);

      const activeId =
        asmRes.assessments.some((a) => a.id === selectedAssessmentId)
          ? selectedAssessmentId
          : asmRes.assessments[0]?.id || '';
      setSelectedAssessmentId(activeId);

      const activeAsm = asmRes.assessments.find((a) => a.id === activeId);
      if (activeAsm) {
        const map: Record<string, number> = {};
        activeAsm.marks.forEach((m) => {
          map[m.studentId] = m.scoredMarks;
        });
        setEditedMarks(map);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load academic assessments' });
    }
  }, [selectedDepartmentId, selectedAssessmentId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activeAssessment = assessments.find((a) => a.id === selectedAssessmentId) || null;

  const handleSelectAssessment = (asm: AssessmentItem) => {
    setSelectedAssessmentId(asm.id);
    const map: Record<string, number> = {};
    asm.marks.forEach((m) => {
      map[m.studentId] = m.scoredMarks;
    });
    setEditedMarks(map);
  };

  const handleSaveMarks = async (submitForVerification: boolean) => {
    if (!activeAssessment) return;
    setFeedback(null);
    try {
      const marksPayload = activeAssessment.marks.map((m) => ({
        studentId: m.studentId,
        scoredMarks: editedMarks[m.studentId] ?? m.scoredMarks,
      }));
      await apiRequest(`/assessments/${activeAssessment.id}/marks`, {
        method: 'POST',
        body: JSON.stringify({ marks: marksPayload, submitForVerification }),
      });
      setFeedback({
        type: 'success',
        message: submitForVerification
          ? `${activeAssessment.title} submitted to HOD/Exam Coordinator for verification.`
          : `Saved draft marks for ${activeAssessment.title}.`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Unable to save marks' });
    }
  };

  const handlePublishResults = async () => {
    if (!activeAssessment) return;
    setFeedback(null);
    try {
      await apiRequest(`/assessments/${activeAssessment.id}/publish`, { method: 'POST' });
      setFeedback({
        type: 'success',
        message: `Published ${activeAssessment.title}. Students can now view verified scores.`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to publish results' });
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const subj = subjects.find((s) => s.id === asgForm.subjectId) || subjects[0];
      await apiRequest('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          ...asgForm,
          subjectId: subj.id,
          sectionId: subj.sectionId,
        }),
      });
      setShowAsgForm(false);
      setAsgForm({ subjectId: '', title: '', instructions: '', maxMarks: 25, dueDate: '2026-11-25' });
      setFeedback({ type: 'success', message: 'Assignment published to section portal.' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create assignment' });
    }
  };

  const handleStudentSubmit = async (asgId: string) => {
    setFeedback(null);
    try {
      await apiRequest(`/assignments/${asgId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: submitFile[asgId] || `${user?.username || 'student'}_deliverable.pdf`,
          notes: 'Submitted online.',
        }),
      });
      setFeedback({ type: 'success', message: 'Assignment submission recorded with timestamp.' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Submission failed' });
    }
  };

  const handleGradeSubmission = async (asgId: string, submissionId: string) => {
    setFeedback(null);
    const input = gradeInputs[submissionId] || { marks: 22, feedback: 'Well structured submission.' };
    try {
      await apiRequest(`/assignments/${asgId}/grade`, {
        method: 'POST',
        body: JSON.stringify({ submissionId, marks: input.marks, feedback: input.feedback }),
      });
      setFeedback({ type: 'success', message: 'Marks and feedback returned to student.' });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Grading failed' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Assessments, Results & Coursework"
        subtitle={
          isStudent
            ? 'View HOD-published assessment results, submit assignments, and download learning materials'
            : 'Manage internal assessment marks, controlled result publication, assignments & learning resources'
        }
        actions={
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('assessments')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'assessments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Assessments &amp; Marks
            </button>
            <button
              type="button"
              onClick={() => setTab('assignments')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'assignments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              Assignments &amp; Materials
            </button>
          </div>
        }
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {tab === 'assessments' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Assessment Cycle List */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              {isStudent ? 'Published Assessment Results' : 'Assessment Components'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {isStudent
                ? 'Unpublished draft marks are restricted until HOD verification.'
                : 'Draft → Submit to HOD → Publish workflow'}
            </p>
            <div className="space-y-2">
              {assessments.map((asm) => (
                <button
                  key={asm.id}
                  type="button"
                  onClick={() => handleSelectAssessment(asm)}
                  className={`w-full text-left border rounded-md p-3 transition-colors cursor-pointer ${
                    asm.id === activeAssessment?.id
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-blue-700">{asm.subjectCode}</span>
                    <StatusLabel status={asm.status} />
                  </div>
                  <div className="text-xs font-medium text-slate-900 mt-1">{asm.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {asm.sectionName} · {asm.examDate} · Max {asm.maxMarks}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Marks Ledger & Publication Controls */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
            {activeAssessment ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">{activeAssessment.title}</h2>
                      <StatusLabel status={activeAssessment.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {activeAssessment.subjectCode} · {activeAssessment.sectionName} · Max {activeAssessment.maxMarks} · Pass {activeAssessment.passMarks}
                    </p>
                  </div>

                  {!isStudent && activeAssessment.status !== 'PUBLISHED' && (
                    <div className="flex flex-wrap items-center gap-2">
                      {can('assessments', 'edit') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveMarks(false)}
                            className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Save Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveMarks(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Submit to HOD
                          </button>
                        </>
                      )}
                      {can('assessments', 'publish') && (
                        <button
                          type="button"
                          onClick={handlePublishResults}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verify &amp; Publish Results
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                        <th className="py-2 pr-4">Register No</th>
                        <th className="py-2 px-3">Student Name</th>
                        <th className="py-2 px-3 text-right">Marks (/ {activeAssessment.maxMarks})</th>
                        <th className="py-2 pl-4">Result Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeAssessment.marks.map((m) => {
                        const score = editedMarks[m.studentId] ?? m.scoredMarks;
                        const pass = score >= activeAssessment.passMarks;
                        const editable = !isStudent && activeAssessment.status !== 'PUBLISHED' && can('assessments', 'edit');
                        return (
                          <tr key={m.studentId}>
                            <td className="py-2.5 pr-4 font-mono text-slate-700">
                              {m.registerNumber || user?.username}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {m.studentName || user?.fullName}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {editable ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={activeAssessment.maxMarks}
                                  value={score}
                                  onChange={(e) =>
                                    setEditedMarks((prev) => ({
                                      ...prev,
                                      [m.studentId]: Math.max(0, Math.min(activeAssessment.maxMarks, Number(e.target.value))),
                                    }))
                                  }
                                  className="w-20 rounded border border-slate-300 px-2 py-1 text-right font-mono tabular-nums"
                                />
                              ) : (
                                <span className="font-mono tabular-nums font-semibold text-slate-900">
                                  {score}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pl-4">
                              <StatusLabel status={pass ? 'VERIFIED' : 'ABSENT'} label={pass ? 'Pass' : 'Below Pass'} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">No assessments available.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Assignments Header & Create */}
          {!isStudent && can('assignments', 'create') && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAsgForm((prev) => ({ ...prev, subjectId: subjects[0]?.id || '' }));
                  setShowAsgForm(!showAsgForm);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Assignment
              </button>
            </div>
          )}

          {showAsgForm && (
            <form onSubmit={handleCreateAssignment} className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <select
                value={asgForm.subjectId}
                onChange={(e) => setAsgForm({ ...asgForm, subjectId: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} · {s.title}</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Assignment Title"
                value={asgForm.title}
                onChange={(e) => setAsgForm({ ...asgForm, title: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                placeholder="Instructions"
                value={asgForm.instructions}
                onChange={(e) => setAsgForm({ ...asgForm, instructions: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="date"
                value={asgForm.dueDate}
                onChange={(e) => setAsgForm({ ...asgForm, dueDate: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-4 py-2 cursor-pointer"
              >
                Publish Assignment
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {assignments.map((asg) => (
                <div key={asg.id} className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-mono text-blue-700">
                        {asg.subjectCode} · {asg.sectionName} · Due {asg.dueDate}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mt-1">{asg.title}</h3>
                      <p className="text-xs text-slate-600 mt-1">{asg.instructions}</p>
                    </div>
                    <span className="font-mono text-xs text-slate-700 shrink-0">Max {asg.maxMarks} Marks</span>
                  </div>

                  {isStudent ? (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      {asg.submissions.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="font-medium text-slate-900">Submitted: {asg.submissions[0].fileName}</span>
                            {asg.submissions[0].feedback && (
                              <p className="text-slate-500 mt-0.5">Feedback: {asg.submissions[0].feedback}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {asg.submissions[0].marks !== undefined && (
                              <span className="font-mono font-semibold text-emerald-700">
                                {asg.submissions[0].marks}/{asg.maxMarks}
                              </span>
                            )}
                            <StatusLabel status={asg.submissions[0].status} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={submitFile[asg.id] || ''}
                            onChange={(e) => setSubmitFile((p) => ({ ...p, [asg.id]: e.target.value }))}
                            placeholder="Deliverable filename (e.g. 24CSE101_Report.pdf)"
                            className="flex-1 min-w-[200px] rounded border border-slate-300 px-3 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleStudentSubmit(asg.id)}
                            className="px-3.5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
                          >
                            Upload &amp; Submit
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                      <div className="text-xs font-medium text-slate-700">
                        Student Submissions ({asg.submissions.length})
                      </div>
                      {asg.submissions.length === 0 ? (
                        <p className="text-xs text-slate-400">No submissions received yet.</p>
                      ) : (
                        asg.submissions.map((sub) => (
                          <div key={sub.id} className="bg-slate-50 rounded p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div>
                              <div className="font-medium text-slate-900">
                                {sub.registerNumber} · {sub.studentName}
                              </div>
                              <div className="text-slate-500 mt-0.5">{sub.fileName}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {sub.status === 'GRADED' ? (
                                <>
                                  <span className="font-mono font-semibold text-emerald-700">
                                    {sub.marks}/{asg.maxMarks}
                                  </span>
                                  <StatusLabel status="GRADED" />
                                </>
                              ) : can('assignments', 'edit') ? (
                                <>
                                  <input
                                    type="number"
                                    min={0}
                                    max={asg.maxMarks}
                                    placeholder="Marks"
                                    value={gradeInputs[sub.id]?.marks ?? 22}
                                    onChange={(e) =>
                                      setGradeInputs((p) => ({
                                        ...p,
                                        [sub.id]: {
                                          marks: Number(e.target.value),
                                          feedback: p[sub.id]?.feedback || 'Well evaluated.',
                                        },
                                      }))
                                    }
                                    className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleGradeSubmission(asg.id, sub.id)}
                                    className="px-2.5 py-1 rounded bg-blue-700 text-white text-[11px] font-medium cursor-pointer"
                                  >
                                    Grade
                                  </button>
                                </>
                              ) : (
                                <StatusLabel status={sub.status} />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Learning Materials */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 h-fit">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-semibold text-slate-900">Course Learning Materials</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {materials.map((mat) => (
                  <div key={mat.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="text-[11px] font-mono text-blue-700">
                      {mat.subjectCode} · Unit {mat.unitNumber} · {mat.resourceType}
                    </div>
                    <div className="text-xs font-medium text-slate-900 mt-0.5">{mat.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {mat.uploadedByName} · {mat.uploadedAt}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
