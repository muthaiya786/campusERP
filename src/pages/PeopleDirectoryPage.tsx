import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, UserPlus, Users } from 'lucide-react';
import { FeedbackBanner, getInitials, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface StudentRow {
  id: string;
  registerNumber: string;
  fullName: string;
  email: string;
  phone: string;
  departmentCode?: string;
  programmeName: string;
  batchLabel: string;
  semester: number;
  yearOfStudy?: number;
  yearLabel?: string;
  sectionName: string;
  mentorName: string;
  admissionCategory: string;
  status: string;
  cgpa: number;
  attendancePct: number;
  feeDue: number;
  guardianName: string;
  guardianPhone: string;
  address: string;
  documentsVerified: boolean;
}

interface StaffRow {
  id: string;
  staffCode: string;
  fullName: string;
  email: string;
  phone: string;
  category: 'TEACHING' | 'NON_TEACHING';
  designation: string;
  qualification: string;
  specialization: string;
  status: string;
  weeklyMaxHours: number;
  currentWeeklyHours: number;
  assignedRoles: string[];
  assignedSubjects: { id: string; code: string; title: string }[];
  fdpCount: number;
  publicationCount: number;
}

const YEAR_OPTIONS = [
  { value: 'ALL', label: 'All Years' },
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
] as const;

export function PeopleDirectoryPage({ initialTab = 'students' }: { initialTab?: 'students' | 'staff' }) {
  const { selectedDepartmentId, departments, can } = useAuth();
  const [tab, setTab] = useState<'students' | 'staff'>(initialTab);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<'ALL' | '1' | '2' | '3' | '4'>('ALL');
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [newStudent, setNewStudent] = useState({ registerNumber: '', fullName: '', email: '', phone: '', semester: 1 });
  const [newStaff, setNewStaff] = useState({ staffCode: '', fullName: '', email: '', designation: 'Assistant Professor', category: 'TEACHING' as 'TEACHING' | 'NON_TEACHING' });

  const canViewStaff = can('staff', 'view');
  const activeDept = departments.find((d) => d.id === selectedDepartmentId);

  const loadPeople = useCallback(async () => {
    try {
      const stuRes = await apiRequest<{ students: StudentRow[] }>(`/students?departmentId=${encodeURIComponent(selectedDepartmentId)}`);
      setStudents(stuRes.students);
      if (canViewStaff) {
        const stRes = await apiRequest<{ staff: StaffRow[] }>(`/staff?departmentId=${encodeURIComponent(selectedDepartmentId)}`);
        setStaff(stRes.staff);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load directory' });
    }
  }, [selectedDepartmentId, canViewStaff]);

  useEffect(() => {
    setSelectedStudent(null);
    void loadPeople();
  }, [loadPeople]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiRequest('/students', {
        method: 'POST',
        body: JSON.stringify({ ...newStudent, departmentId: selectedDepartmentId }),
      });
      setShowAddModal(false);
      setNewStudent({ registerNumber: '', fullName: '', email: '', phone: '', semester: 1 });
      setFeedback({ type: 'success', message: 'Student profile admitted and audited.' });
      await loadPeople();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to admit student' });
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await apiRequest('/staff', {
        method: 'POST',
        body: JSON.stringify({ ...newStaff, departmentId: selectedDepartmentId }),
      });
      setShowAddModal(false);
      setNewStaff({ staffCode: '', fullName: '', email: '', designation: 'Assistant Professor', category: 'TEACHING' });
      setFeedback({ type: 'success', message: 'Staff member onboarded successfully with annual leave quota.' });
      await loadPeople();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to onboard staff' });
    }
  };

  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: students.length, '1': 0, '2': 0, '3': 0, '4': 0 };
    for (const s of students) {
      const yr = String(s.yearOfStudy ?? Math.ceil((s.semester || 1) / 2));
      counts[yr] = (counts[yr] || 0) + 1;
    }
    return counts;
  }, [students]);

  const filteredStudents = students.filter((s) => {
    const yr = String(s.yearOfStudy ?? Math.ceil((s.semester || 1) / 2));
    if (yearFilter !== 'ALL' && yr !== yearFilter) return false;
    const q = search.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.registerNumber.toLowerCase().includes(q) ||
      s.sectionName.toLowerCase().includes(q) ||
      (s.yearLabel || '').toLowerCase().includes(q)
    );
  });

  const filteredStaff = staff.filter(
    (s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.staffCode.toLowerCase().includes(search.toLowerCase()) ||
      s.designation.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title={`Student & Faculty Directory${activeDept ? ` · ${activeDept.code}` : ''}`}
        subtitle={`Department-scoped student rosters by year of study, academic standing, and staff workload${activeDept ? ` for ${activeDept.name}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {canViewStaff && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTab('students');
                    setShowAddModal(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    tab === 'students' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Students ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('staff');
                    setShowAddModal(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    tab === 'staff' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Faculty &amp; Staff ({staff.length})
                </button>
              </div>
            )}

            {((tab === 'students' && can('students', 'create')) ||
              (tab === 'staff' && can('staff', 'create'))) && (
              <button
                type="button"
                onClick={() => setShowAddModal(!showAddModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {tab === 'students' ? 'Admit Student' : 'Onboard Staff'}
              </button>
            )}
          </div>
        }
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {/* Search & Year-Wise Filter Strip */}
      <div className="mb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'students' ? 'Search register number, name, year, section...' : 'Search staff code, name, designation...'}
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {tab === 'students' && (
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {YEAR_OPTIONS.map((yr) => (
              <button
                key={yr.value}
                type="button"
                onClick={() => setYearFilter(yr.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap tabular-nums ${
                  yearFilter === yr.value ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {yr.label} ({yearCounts[yr.value] ?? 0})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Forms */}
      {showAddModal && tab === 'students' && (
        <form onSubmit={handleCreateStudent} className="bg-white border border-slate-200 rounded-lg p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input
            type="text"
            required
            placeholder={`Register No (e.g. 26${activeDept?.code || 'CSE'}110)`}
            value={newStudent.registerNumber}
            onChange={(e) => setNewStudent({ ...newStudent, registerNumber: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="text"
            required
            placeholder="Full Name"
            value={newStudent.fullName}
            onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="email"
            required
            placeholder="Institutional Email"
            value={newStudent.email}
            onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="text"
            placeholder="Phone"
            value={newStudent.phone}
            onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <select
            value={newStudent.semester}
            onChange={(e) => setNewStudent({ ...newStudent, semester: Number(e.target.value) })}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs bg-white"
          >
            <option value={1}>1st Year (Sem 1)</option>
            <option value={3}>2nd Year (Sem 3)</option>
            <option value={5}>3rd Year (Sem 5)</option>
            <option value={7}>4th Year (Sem 7)</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-4 py-2 cursor-pointer"
          >
            Save Student
          </button>
        </form>
      )}

      {showAddModal && tab === 'staff' && (
        <form onSubmit={handleCreateStaff} className="bg-white border border-slate-200 rounded-lg p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            required
            placeholder={`Staff Code (VIT-${activeDept?.code || 'CSE'}-030)`}
            value={newStaff.staffCode}
            onChange={(e) => setNewStaff({ ...newStaff, staffCode: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="text"
            required
            placeholder="Full Name"
            value={newStaff.fullName}
            onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={newStaff.email}
            onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <select
            value={newStaff.category}
            onChange={(e) => setNewStaff({ ...newStaff, category: e.target.value as 'TEACHING' | 'NON_TEACHING' })}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs bg-white"
          >
            <option value="TEACHING">Teaching Faculty</option>
            <option value="NON_TEACHING">Non-Teaching Staff</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-4 py-2 cursor-pointer"
          >
            Save Staff
          </button>
        </form>
      )}

      {tab === 'students' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${selectedStudent ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white border border-slate-200 rounded-lg overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="py-3 px-4">Register No</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Year &amp; Section</th>
                    <th className="py-3 px-4 text-right">Attendance</th>
                    <th className="py-3 px-4 text-right">CGPA</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStudents.map((st) => (
                    <tr
                      key={st.id}
                      onClick={() => setSelectedStudent(st)}
                      className={`hover:bg-slate-50 cursor-pointer ${selectedStudent?.id === st.id ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="py-3 px-4 font-medium tabular-nums text-slate-800">{st.registerNumber}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[11px] font-semibold shrink-0">
                            {getInitials(st.fullName)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{st.fullName}</div>
                            <div className="text-[11px] text-slate-500">{st.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="font-medium text-slate-900">{st.yearLabel || `Year ${Math.ceil((st.semester || 1) / 2)}`}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span>{st.sectionName}</span>
                      </td>
                      <td className={`py-3 px-4 text-right tabular-nums font-medium ${st.attendancePct < 75 ? 'text-red-700' : 'text-slate-900'}`}>
                        {st.attendancePct}%
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-blue-700">
                        {st.cgpa.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel status={st.status} />
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 px-4 text-center text-xs text-slate-500">
                        No students found for the selected department and year filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedStudent && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 h-fit">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                    {getInitials(selectedStudent.fullName)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{selectedStudent.fullName}</h3>
                    <p className="text-xs font-medium text-blue-700 tabular-nums">{selectedStudent.registerNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  Close
                </button>
              </div>

              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Programme</dt>
                  <dd className="font-medium text-slate-900 text-right">{selectedStudent.programmeName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Year &amp; Section</dt>
                  <dd className="font-medium text-slate-900">
                    {selectedStudent.yearLabel || `Year ${Math.ceil((selectedStudent.semester || 1) / 2)}`} · {selectedStudent.sectionName}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Batch</dt>
                  <dd className="font-medium text-slate-900 tabular-nums">{selectedStudent.batchLabel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Faculty Mentor</dt>
                  <dd className="font-medium text-slate-900">{selectedStudent.mentorName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Admission Category</dt>
                  <dd className="font-medium text-slate-900">{selectedStudent.admissionCategory}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Guardian</dt>
                  <dd className="font-medium text-slate-900">{selectedStudent.guardianName} ({selectedStudent.guardianPhone})</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Fee Balance</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">₹{selectedStudent.feeDue.toLocaleString('en-IN')}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Document Verification</dt>
                  <dd><StatusLabel status={selectedStudent.documentsVerified ? 'VERIFIED' : 'PENDING'} /></dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Staff Code</th>
                  <th className="py-3 px-4">Faculty / Staff</th>
                  <th className="py-3 px-4">Designation &amp; Roles</th>
                  <th className="py-3 px-4">Assigned Subjects</th>
                  <th className="py-3 px-4 text-right">Workload</th>
                  <th className="py-3 px-4 text-right">Research / FDP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStaff.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium tabular-nums text-slate-700">{st.staffCode}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{st.fullName}</div>
                      <div className="text-[11px] text-slate-500">{st.qualification} · {st.specialization}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-900">{st.designation}</div>
                      <div className="text-[11px] font-medium text-blue-700 mt-0.5">
                        {st.assignedRoles.join(' · ')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {st.assignedSubjects.length > 0
                        ? st.assignedSubjects.map((s) => s.code).join(', ')
                        : st.category === 'NON_TEACHING'
                        ? 'Laboratory & Infrastructure'
                        : 'Administration'}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-900">
                      {st.currentWeeklyHours}/{st.weeklyMaxHours} hrs/wk
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                      {st.publicationCount} pubs · {st.fdpCount} FDPs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

