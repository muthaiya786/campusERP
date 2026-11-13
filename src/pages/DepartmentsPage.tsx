import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Plus, Power } from 'lucide-react';
import { FeedbackBanner, KpiMetricCard, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface DepartmentDetail {
  id: string;
  code: string;
  name: string;
  hodStaffId?: string;
  hodName: string;
  email: string;
  vision: string;
  mission: string;
  active: boolean;
  createdAt: string;
  programmeCount: number;
  studentCount: number;
  staffCount: number;
  subjectCount: number;
  programmes: {
    id: string;
    code: string;
    name: string;
    category: string;
    totalSemesters: number;
    intakeCapacity: number;
  }[];
}

export function DepartmentsPage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { selectedDepartmentId, setSelectedDepartmentId, refreshSession, can } = useAuth();
  const [departments, setDepartments] = useState<DepartmentDetail[]>([]);
  const [regulations, setRegulations] = useState<{ id: string; code: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    code: '',
    name: '',
    hodName: '',
    hodEmail: '',
    programmeCode: '',
    programmeName: '',
    programmeCategory: 'UG' as 'UG' | 'PG' | 'PhD' | 'Diploma',
    totalSemesters: 8,
    intakeCapacity: 60,
    regulationId: 'reg-2025',
    vision: '',
    mission: '',
  });

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        departments: DepartmentDetail[];
        regulations: { id: string; code: string; name: string }[];
      }>('/departments');
      setDepartments(res.departments);
      setRegulations(res.regulations);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load departments' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiRequest<{ department: { id: string; code: string; name: string } }>('/departments', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({
        code: '',
        name: '',
        hodName: '',
        hodEmail: '',
        programmeCode: '',
        programmeName: '',
        programmeCategory: 'UG',
        totalSemesters: 8,
        intakeCapacity: 60,
        regulationId: 'reg-2025',
        vision: '',
        mission: '',
      });
      await refreshSession();
      setSelectedDepartmentId(res.department.id);
      await loadDepartments();
      setFeedback({
        type: 'success',
        message: `Department ${res.department.code} (${res.department.name}) created and activated. Workspace switched to ${res.department.code}.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create department' });
    }
  };

  const handleToggleActive = async (dept: DepartmentDetail) => {
    setFeedback(null);
    try {
      await apiRequest(`/departments/${dept.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !dept.active }),
      });
      await refreshSession();
      await loadDepartments();
      setFeedback({
        type: 'success',
        message: `${dept.code} marked ${!dept.active ? 'Active' : 'Inactive'}. Historical records preserved.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Status update failed' });
    }
  };

  const handlePresetFill = (preset: 'ECE' | 'AIDS') => {
    if (preset === 'ECE') {
      setForm({
        code: 'ECE',
        name: 'Electronics & Communication Engineering',
        hodName: 'Dr. Aravind Swaminathan',
        hodEmail: 'hod.ece@vanguardtech.edu.in',
        programmeCode: 'BE-ECE',
        programmeName: 'B.E. Electronics & Communication Engineering',
        programmeCategory: 'UG',
        totalSemesters: 8,
        intakeCapacity: 60,
        regulationId: 'reg-2025',
        vision: 'To lead innovation in VLSI, embedded systems, and wireless communications.',
        mission: 'Provide rigorous hardware-software co-design laboratories and industry research.',
      });
    } else {
      setForm({
        code: 'AIDS',
        name: 'Artificial Intelligence & Data Science',
        hodName: 'Dr. Kavitha Balasubramani',
        hodEmail: 'hod.aids@vanguardtech.edu.in',
        programmeCode: 'BTECH-AIDS',
        programmeName: 'B.Tech. Artificial Intelligence & Data Science',
        programmeCategory: 'UG',
        totalSemesters: 8,
        intakeCapacity: 120,
        regulationId: 'reg-2025',
        vision: 'To build ethical AI researchers and applied data engineers.',
        mission: 'Combine statistical rigor, scalable computing, and domain intelligence.',
      });
    }
  };

  const activeCount = departments.filter((d) => d.active).length;
  const totalStudents = departments.reduce((sum, d) => sum + d.studentCount, 0);
  const totalStaff = departments.reduce((sum, d) => sum + d.staffCount, 0);

  return (
    <div>
      <PageHeader
        title="Departments & Multi-Department Expansion"
        subtitle="Initially active with CSE; configure additional academic departments, HODs, programmes, and semester structures with zero code changes"
        actions={
          can('settings', 'create') && (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {showForm ? 'Close Form' : 'Create New Department'}
            </button>
          )
        }
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {/* Institution Multi-Dept Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiMetricCard
          label="Configured Departments"
          value={departments.length}
          subtext={`${activeCount} active department(s) operational`}
          tone="accent"
        />
        <KpiMetricCard
          label="Institution Students"
          value={totalStudents}
          subtext="Isolated by department & section scope"
          tone="neutral"
        />
        <KpiMetricCard
          label="Institution Faculty & Staff"
          value={totalStaff}
          subtext="Department-assigned teaching & lab roles"
          tone="neutral"
        />
        <KpiMetricCard
          label="Current Workspace Scope"
          value={departments.find((d) => d.id === selectedDepartmentId)?.code || 'CSE'}
          subtext="Switch scope from any department card below"
          tone="positive"
        />
      </div>

      {/* Create Department Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-lg p-6 mb-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Provision New Academic Department</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Creates department master, assigns HOD staff profile, and provisions initial programme, batch, and Section A
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Quick Templates:</span>
              <button
                type="button"
                onClick={() => handlePresetFill('ECE')}
                className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Fill ECE Template
              </button>
              <button
                type="button"
                onClick={() => handlePresetFill('AIDS')}
                className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Fill AI &amp; DS Template
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department Code *</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. ECE"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Department Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Electronics & Communication Engineering"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Regulation</label>
              <select
                value={form.regulationId}
                onChange={(e) => setForm({ ...form, regulationId: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs bg-white"
              >
                {regulations.map((r) => (
                  <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">HOD Full Name</label>
              <input
                type="text"
                value={form.hodName}
                onChange={(e) => setForm({ ...form, hodName: e.target.value })}
                placeholder="e.g. Dr. Aravind Swaminathan"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department / HOD Email</label>
              <input
                type="email"
                value={form.hodEmail}
                onChange={(e) => setForm({ ...form, hodEmail: e.target.value })}
                placeholder="hod.ece@vanguardtech.edu.in"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Initial Programme Code</label>
              <input
                type="text"
                value={form.programmeCode}
                onChange={(e) => setForm({ ...form, programmeCode: e.target.value })}
                placeholder="BE-ECE"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Initial Programme Name</label>
              <input
                type="text"
                value={form.programmeName}
                onChange={(e) => setForm({ ...form, programmeName: e.target.value })}
                placeholder="B.E. Electronics & Communication"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Programme Category</label>
              <select
                value={form.programmeCategory}
                onChange={(e) => setForm({ ...form, programmeCategory: e.target.value as 'UG' | 'PG' })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs bg-white"
              >
                <option value="UG">UG (Undergraduate)</option>
                <option value="PG">PG (Postgraduate)</option>
                <option value="Diploma">Diploma</option>
                <option value="PhD">PhD Research</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Configurable Semesters</label>
              <input
                type="number"
                min={2}
                max={12}
                value={form.totalSemesters}
                onChange={(e) => setForm({ ...form, totalSemesters: Number(e.target.value) })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Annual Intake Capacity</label>
              <input
                type="number"
                min={10}
                max={300}
                value={form.intakeCapacity}
                onChange={(e) => setForm({ ...form, intakeCapacity: Number(e.target.value) })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department Vision</label>
              <input
                type="text"
                value={form.vision}
                onChange={(e) => setForm({ ...form, vision: e.target.value })}
                placeholder="Vision statement..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Create &amp; Activate Department
            </button>
          </div>
        </form>
      )}

      {/* Department Cards Grid */}
      {loading ? (
        <div className="h-44 bg-white border border-slate-200 rounded-lg animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {departments.map((dept) => {
            const isCurrent = dept.id === selectedDepartmentId;
            return (
              <div
                key={dept.id}
                className={`bg-white border rounded-lg p-6 transition-colors ${
                  isCurrent ? 'border-blue-600' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-mono text-xs font-semibold shrink-0">
                      {dept.code}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{dept.name}</h3>
                      <div className="text-xs text-slate-500 mt-0.5">
                        HOD: <span className="font-medium text-slate-800">{dept.hodName}</span> · {dept.email}
                      </div>
                    </div>
                  </div>
                  <StatusLabel status={dept.active ? 'ACTIVE' : 'INACTIVE'} />
                </div>

                <p className="text-xs text-slate-600 mt-4 leading-relaxed">{dept.vision}</p>

                <div className="grid grid-cols-4 gap-3 my-4 py-3 border-y border-slate-100 text-center">
                  <div>
                    <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
                      {dept.programmeCount}
                    </div>
                    <div className="text-[11px] text-slate-500">Programmes</div>
                  </div>
                  <div>
                    <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
                      {dept.studentCount}
                    </div>
                    <div className="text-[11px] text-slate-500">Students</div>
                  </div>
                  <div>
                    <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
                      {dept.staffCount}
                    </div>
                    <div className="text-[11px] text-slate-500">Staff</div>
                  </div>
                  <div>
                    <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
                      {dept.subjectCount}
                    </div>
                    <div className="text-[11px] text-slate-500">Subjects</div>
                  </div>
                </div>

                {dept.programmes.length > 0 && (
                  <div className="mb-4 space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500">Configured Programmes</div>
                    {dept.programmes.map((p) => (
                      <div key={p.id} className="text-xs text-slate-800 flex items-center justify-between">
                        <span>
                          <span className="font-mono text-blue-700 mr-1.5">{p.code}</span>
                          {p.name}
                        </span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          {p.totalSemesters} Sems · Cap {p.intakeCapacity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDepartmentId(dept.id);
                        onNavigate('dashboard');
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-blue-700 hover:bg-blue-800 text-white'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      {isCurrent ? 'Active Scope' : 'Switch Workspace Here'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDepartmentId(dept.id);
                        onNavigate('students');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Open Roster
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {can('settings', 'edit') && dept.id !== 'dept-cse' && (
                    <button
                      type="button"
                      onClick={() => handleToggleActive(dept)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      <Power className="w-3 h-3" />
                      {dept.active ? 'Archive' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
