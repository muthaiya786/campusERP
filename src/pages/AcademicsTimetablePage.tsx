import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, Plus } from 'lucide-react';
import { FeedbackBanner, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface StructureResponse {
  programmes: { id: string; code: string; name: string; category: string; totalSemesters: number; intakeCapacity: number }[];
  regulations: { id: string; code: string; name: string; minAttendancePct: number; internalWeightagePct: number; externalWeightagePct: number }[];
  batches: { id: string; label: string; currentSemester: number }[];
  sections: { id: string; name: string; semester: number; roomCode: string }[];
  subjects: {
    id: string;
    code: string;
    title: string;
    category: string;
    semester: number;
    credits: number;
    facultyStaffId: string;
    facultyName: string;
    sectionId: string;
    sectionName: string;
    courseOutcomes: string[];
    syllabusUnits: { unitNumber: number; title: string; totalTopics: number; completedTopics: number; targetDate: string }[];
  }[];
}

interface TimetableSlotRow {
  id: string;
  sectionId: string;
  sectionName: string;
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
  facultyStaffId: string;
  facultyName: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
  period: number;
  startTime: string;
  endTime: string;
  roomCode: string;
  slotType: 'THEORY' | 'PRACTICAL' | 'TUTORIAL' | 'PROJECT';
  published: boolean;
}

const DAYS: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri')[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = [1, 2, 3, 4, 5];

export function AcademicsTimetablePage({ initialTab = 'timetable' }: { initialTab?: 'timetable' | 'curriculum' }) {
  const { selectedDepartmentId, can } = useAuth();
  const [tab, setTab] = useState<'timetable' | 'curriculum'>(initialTab);
  const [structure, setStructure] = useState<StructureResponse | null>(null);
  const [slots, setSlots] = useState<TimetableSlotRow[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; fullName: string }[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('sec-5a');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add Slot Form
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({
    sectionId: 'sec-5a',
    subjectId: '',
    facultyStaffId: '',
    day: 'Thu' as 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri',
    period: 1,
    roomCode: 'CS-301',
    slotType: 'THEORY' as 'THEORY' | 'PRACTICAL' | 'TUTORIAL' | 'PROJECT',
  });

  // Add Subject Form
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    title: '',
    category: 'CORE',
    semester: 5,
    credits: 3,
    facultyStaffId: '',
    sectionId: 'sec-5a',
  });

  const loadData = useCallback(async () => {
    try {
      const [strRes, ttRes] = await Promise.all([
        apiRequest<StructureResponse>(`/academics/structure?departmentId=${encodeURIComponent(selectedDepartmentId)}`),
        apiRequest<{ slots: TimetableSlotRow[] }>(`/timetable?departmentId=${encodeURIComponent(selectedDepartmentId)}`),
      ]);
      setStructure(strRes);
      setSlots(ttRes.slots);
      if (strRes.sections.length && !strRes.sections.some((s) => s.id === selectedSection)) {
        setSelectedSection(strRes.sections[0].id);
      }
      if (can('staff', 'view')) {
        const stRes = await apiRequest<{ staff: { id: string; fullName: string }[] }>(
          `/staff?departmentId=${encodeURIComponent(selectedDepartmentId)}`
        );
        setStaffList(stRes.staff);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load academic data' });
    }
  }, [selectedDepartmentId, can, selectedSection]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiRequest('/timetable', {
        method: 'POST',
        body: JSON.stringify({ ...slotForm, departmentId: selectedDepartmentId }),
      });
      setFeedback({ type: 'success', message: 'Timetable slot added as Draft without clashes.' });
      setShowSlotForm(false);
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Clash detected or invalid slot' });
    }
  };

  const handlePublishTimetable = async () => {
    setFeedback(null);
    try {
      const res = await apiRequest<{ publishedCount: number }>('/timetable/publish', {
        method: 'POST',
        body: JSON.stringify({ departmentId: selectedDepartmentId }),
      });
      setFeedback({
        type: 'success',
        message: `Published ${res.publishedCount} draft timetable slot(s) to student and faculty portals.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to publish' });
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiRequest('/subjects', {
        method: 'POST',
        body: JSON.stringify({ ...subjectForm, departmentId: selectedDepartmentId }),
      });
      setFeedback({ type: 'success', message: `Mapped subject ${subjectForm.code.toUpperCase()} successfully.` });
      setShowSubjectForm(false);
      setSubjectForm({ code: '', title: '', category: 'CORE', semester: 5, credits: 3, facultyStaffId: '', sectionId: selectedSection });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create subject' });
    }
  };

  const handleTopicChange = async (subjectId: string, unitNumber: number, completedTopics: number) => {
    try {
      await apiRequest(`/subjects/${subjectId}/syllabus`, {
        method: 'PATCH',
        body: JSON.stringify({ unitNumber, completedTopics }),
      });
      await loadData();
      setFeedback({ type: 'success', message: `Syllabus Unit ${unitNumber} progress saved & audited.` });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Update failed' });
    }
  };

  const sectionSlots = slots.filter((s) => s.sectionId === selectedSection);
  const draftCount = slots.filter((s) => !s.published).length;

  return (
    <div>
      <PageHeader
        title="Academics, Curriculum & Timetable"
        subtitle="Manage normalized programmes, regulations, syllabus unit completion, and clash-validated schedules"
        actions={
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('timetable')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'timetable' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Weekly Timetable
            </button>
            <button
              type="button"
              onClick={() => setTab('curriculum')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'curriculum' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Curriculum &amp; Syllabus
            </button>
          </div>
        }
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {tab === 'timetable' ? (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-medium text-slate-600">Class Section:</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
              >
                {(structure?.sections || []).map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} ({sec.roomCode})
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                {draftCount > 0 ? `${draftCount} draft slot(s) pending publish` : 'All slots published'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {can('timetable', 'create') && (
                <button
                  type="button"
                  onClick={() => {
                    setSlotForm((prev) => ({
                      ...prev,
                      sectionId: selectedSection,
                      subjectId: structure?.subjects[0]?.id || '',
                      facultyStaffId: staffList[0]?.id || structure?.subjects[0]?.facultyStaffId || 'staff-02',
                    }));
                    setShowSlotForm(!showSlotForm);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Timetable Slot
                </button>
              )}
              {can('timetable', 'publish') && draftCount > 0 && (
                <button
                  type="button"
                  onClick={handlePublishTimetable}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Publish Timetable
                </button>
              )}
            </div>
          </div>

          {showSlotForm && (
            <form onSubmit={handleAddSlot} className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Schedule Timetable Slot</h3>
              <p className="text-xs text-slate-500 mb-4">
                Server automatically validates faculty, room, and section clashes before saving.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <select
                  value={slotForm.subjectId}
                  onChange={(e) => setSlotForm({ ...slotForm, subjectId: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                  required
                >
                  <option value="">Select Subject</option>
                  {(structure?.subjects || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.title}
                    </option>
                  ))}
                </select>
                <select
                  value={slotForm.facultyStaffId}
                  onChange={(e) => setSlotForm({ ...slotForm, facultyStaffId: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                  required
                >
                  <option value="">Select Faculty</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName}
                    </option>
                  ))}
                </select>
                <select
                  value={slotForm.day}
                  onChange={(e) => setSlotForm({ ...slotForm, day: e.target.value as 'Mon' })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  value={slotForm.period}
                  onChange={(e) => setSlotForm({ ...slotForm, period: Number(e.target.value) })}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                >
                  {PERIODS.map((p) => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={slotForm.roomCode}
                  onChange={(e) => setSlotForm({ ...slotForm, roomCode: e.target.value })}
                  placeholder="Room (e.g. CS-301)"
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                  required
                />
                <button
                  type="submit"
                  className="rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-4 py-2 cursor-pointer"
                >
                  Validate &amp; Add
                </button>
              </div>
            </form>
          )}

          {/* Weekly Matrix */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="py-3 px-4 w-24">Day</th>
                    {PERIODS.map((p) => (
                      <th key={p} className="py-3 px-3 border-l border-slate-200">
                        Period {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {DAYS.map((day) => (
                    <tr key={day}>
                      <td className="py-4 px-4 font-semibold text-slate-900 bg-slate-50/50">{day}</td>
                      {PERIODS.map((period) => {
                        const slot = sectionSlots.find((s) => s.day === day && s.period === period);
                        return (
                          <td key={period} className="py-3 px-3 border-l border-slate-200 align-top">
                            {slot ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono font-semibold text-blue-700">
                                    {slot.subjectCode}
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-400">
                                    {slot.roomCode}
                                  </span>
                                </div>
                                <div className="font-medium text-slate-900 leading-snug">
                                  {slot.subjectTitle}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {slot.facultyName} · {slot.slotType}
                                </div>
                                {!slot.published && <StatusLabel status="DRAFT" />}
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Programmes & Regulations Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Active Programmes</h3>
              <div className="divide-y divide-slate-100 text-xs">
                {(structure?.programmes || []).map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-slate-500 mt-0.5">
                        {p.code} · {p.category} · {p.totalSemesters} Semesters
                      </div>
                    </div>
                    <span className="font-mono text-slate-700">Intake {p.intakeCapacity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Configured Academic Regulations</h3>
              <div className="divide-y divide-slate-100 text-xs">
                {(structure?.regulations || []).map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{r.name}</div>
                      <div className="text-slate-500 mt-0.5">
                        Internal {r.internalWeightagePct}% / External {r.externalWeightagePct}%
                      </div>
                    </div>
                    <span className="font-mono text-blue-700">Min {r.minAttendancePct}% Att</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Subjects & Syllabus Unit Tracker */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Curriculum Subjects &amp; Syllabus Completion
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Faculty and HODs can adjust completed unit topics below with live audit tracking
                </p>
              </div>
              {can('academics', 'create') && (
                <button
                  type="button"
                  onClick={() => setShowSubjectForm(!showSubjectForm)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Map New Subject
                </button>
              )}
            </div>

            {showSubjectForm && (
              <form onSubmit={handleAddSubject} className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <input
                  type="text"
                  placeholder="Code (CS3509)"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                  required
                />
                <input
                  type="text"
                  placeholder="Subject Title"
                  value={subjectForm.title}
                  onChange={(e) => setSubjectForm({ ...subjectForm, title: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-2"
                  required
                />
                <select
                  value={subjectForm.semester}
                  onChange={(e) => setSubjectForm({ ...subjectForm, semester: Number(e.target.value) })}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Sem {s}</option>
                  ))}
                </select>
                <select
                  value={subjectForm.facultyStaffId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, facultyStaffId: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">Assign Faculty</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>{st.fullName}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-4 py-2 cursor-pointer"
                >
                  Save Subject
                </button>
              </form>
            )}

            <div className="space-y-5">
              {(structure?.subjects || []).map((sub) => {
                const total = sub.syllabusUnits.reduce((s, u) => s + u.totalTopics, 0);
                const done = sub.syllabusUnits.reduce((s, u) => s + u.completedTopics, 0);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={sub.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          <span className="font-mono text-blue-700 mr-2">{sub.code}</span>
                          {sub.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Sem {sub.semester} · {sub.credits} Credits · {sub.category} · Faculty: {sub.facultyName}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {pct}% Complete ({done}/{total} topics)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sub.syllabusUnits.map((unit) => (
                        <div key={unit.unitNumber} className="bg-slate-50 rounded-md p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-900 truncate">
                              Unit {unit.unitNumber}: {unit.title}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                              Target: {unit.targetDate} · {unit.completedTopics}/{unit.totalTopics} topics
                            </div>
                          </div>
                          {can('academics', 'edit') && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleTopicChange(sub.id, unit.unitNumber, unit.completedTopics - 1)}
                                className="w-6 h-6 rounded border border-slate-300 bg-white text-xs hover:bg-slate-100 cursor-pointer"
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTopicChange(sub.id, unit.unitNumber, unit.completedTopics + 1)}
                                className="w-6 h-6 rounded border border-slate-300 bg-white text-xs hover:bg-slate-100 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
