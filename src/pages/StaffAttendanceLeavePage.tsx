import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, CalendarPlus, Check, Clock, Users, X } from 'lucide-react';
import { FeedbackBanner, KpiMetricCard, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { LeaveCategory, StaffAttendanceStatus } from '../types/erp';

interface FormattedLeaveBalance {
  staffId: string;
  departmentId: string;
  academicYearId: string;
  clTotal: number;
  clUsed: number;
  clAvailable: number;
  mlTotal: number;
  mlUsed: number;
  mlAvailable: number;
  odTotal: number;
  odUsed: number;
  odAvailable: number;
  totalAvailable: number;
  totalAllocated: number;
  totalUsed: number;
}

interface StaffRegisterRow {
  staffId: string;
  staffCode: string;
  fullName: string;
  category: 'TEACHING' | 'NON_TEACHING';
  designation: string;
  date: string;
  status: StaffAttendanceStatus;
  checkInTime: string;
  remarks: string;
  markedByName: string;
  isMarkedOnServer: boolean;
  leaveBalance: FormattedLeaveBalance;
}

interface StaffLeaveRequestRow {
  id: string;
  requestNumber: string;
  requesterName: string;
  requesterRole: string;
  staffId?: string;
  leaveCategory?: LeaveCategory;
  daysCount?: number;
  title: string;
  description: string;
  fromDate?: string;
  toDate?: string;
  status: string;
  createdAt: string;
  requesterBalance: FormattedLeaveBalance | null;
}

interface MyAttendanceRow {
  id: string;
  date: string;
  status: StaffAttendanceStatus;
  checkInTime?: string;
  remarks?: string;
  markedByName: string;
}

interface StaffAttendancePayload {
  departmentId: string;
  selectedDate: string;
  canManageRegister: boolean;
  canApproveLeaves: boolean;
  myLeaveBalance: FormattedLeaveBalance | null;
  myAttendanceHistory: MyAttendanceRow[];
  staffRegister: StaffRegisterRow[];
  staffLeaveRequests: StaffLeaveRequestRow[];
  recentDates: string[];
}

const ATTENDANCE_STATUSES: { value: StaffAttendanceStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ON_DUTY', label: 'On Duty' },
  { value: 'HALF_DAY', label: 'Half Day' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'ABSENT', label: 'Absent' },
];

export function StaffAttendanceLeavePage() {
  const { user, selectedDepartmentId, departments } = useAuth();
  const [data, setData] = useState<StaffAttendancePayload | null>(null);
  const [date, setDate] = useState<string>('2026-11-12');
  const [activeTab, setActiveTab] = useState<'register' | 'apply' | 'approvals' | 'balances'>('apply');
  const [registerDraft, setRegisterDraft] = useState<
    Record<string, { status: StaffAttendanceStatus; checkInTime: string; remarks: string }>
  >({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [leaveForm, setLeaveForm] = useState({
    leaveCategory: 'CL' as LeaveCategory,
    fromDate: '2026-11-23',
    toDate: '2026-11-24',
    title: '',
    description: '',
  });

  const loadData = useCallback(
    async (targetDate?: string) => {
      try {
        const params = new URLSearchParams({ departmentId: selectedDepartmentId });
        if (targetDate) params.set('date', targetDate);
        const res = await apiRequest<StaffAttendancePayload>(`/staff-attendance?${params.toString()}`);
        setData(res);
        setDate(res.selectedDate);
        const draft: Record<string, { status: StaffAttendanceStatus; checkInTime: string; remarks: string }> = {};
        for (const row of res.staffRegister) {
          draft[row.staffId] = {
            status: row.status,
            checkInTime: row.checkInTime || '08:55',
            remarks: row.remarks || '',
          };
        }
        setRegisterDraft(draft);
        setActiveTab((prev) => {
          if (prev === 'apply' && res.canManageRegister) return 'register';
          return prev;
        });
      } catch (err) {
        setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load staff attendance' });
      }
    },
    [selectedDepartmentId]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const requestedDays = useMemo(() => {
    if (!leaveForm.fromDate) return 1;
    const start = new Date(`${leaveForm.fromDate}T00:00:00Z`).getTime();
    const end = new Date(`${(leaveForm.toDate || leaveForm.fromDate)}T00:00:00Z`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  }, [leaveForm.fromDate, leaveForm.toDate]);

  const categoryAvailable = useMemo(() => {
    if (!data?.myLeaveBalance) return 0;
    if (leaveForm.leaveCategory === 'CL') return data.myLeaveBalance.clAvailable;
    if (leaveForm.leaveCategory === 'ML') return data.myLeaveBalance.mlAvailable;
    return data.myLeaveBalance.odAvailable;
  }, [data?.myLeaveBalance, leaveForm.leaveCategory]);

  const handleSaveRegister = async () => {
    if (!data) return;
    setSaving(true);
    setFeedback(null);
    try {
      const records = data.staffRegister.map((row) => ({
        staffId: row.staffId,
        status: registerDraft[row.staffId]?.status || row.status,
        checkInTime: registerDraft[row.staffId]?.checkInTime || '08:55',
        remarks: registerDraft[row.staffId]?.remarks || '',
      }));
      const res = await apiRequest<{ savedCount: number; date: string }>('/staff-attendance/mark', {
        method: 'POST',
        body: JSON.stringify({
          departmentId: selectedDepartmentId,
          date,
          records,
        }),
      });
      setFeedback({
        type: 'success',
        message: `Saved staff attendance register for ${res.date} (${res.savedCount} staff records updated).`,
      });
      await loadData(date);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save attendance' });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await apiRequest('/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'STAFF_LEAVE',
          leaveCategory: leaveForm.leaveCategory,
          fromDate: leaveForm.fromDate,
          toDate: leaveForm.toDate,
          title: leaveForm.title,
          description: leaveForm.description,
        }),
      });
      setLeaveForm({
        leaveCategory: 'CL',
        fromDate: '2026-11-23',
        toDate: '2026-11-24',
        title: '',
        description: '',
      });
      setFeedback({
        type: 'success',
        message: `Staff leave application (${requestedDays} day(s)) submitted for HOD approval.`,
      });
      await loadData(date);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Leave submission failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (reqId: string, decision: 'APPROVED' | 'REJECTED') => {
    setSaving(true);
    setFeedback(null);
    try {
      await apiRequest(`/requests/${reqId}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          comment: `${decision} by ${user?.fullName || 'Approver'}.`,
        }),
      });
      setFeedback({
        type: 'success',
        message:
          decision === 'APPROVED'
            ? 'Leave request approved, available leave days updated, and attendance ledger synced.'
            : 'Leave request rejected and recorded in audit trail.',
      });
      await loadData(date);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Decision failed' });
    } finally {
      setSaving(false);
    }
  };

  const deptName = departments.find((d) => d.id === selectedDepartmentId)?.name || 'Department';
  const bal = data?.myLeaveBalance;
  const pendingCount = (data?.staffLeaveRequests || []).filter(
    (r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW'
  ).length;

  return (
    <div>
      <PageHeader
        title="Staff Attendance & Leave Management"
        subtitle={`Daily staff attendance register, available leave day balances, and leave approvals for ${deptName}`}
        actions={
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {data?.canManageRegister && (
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  activeTab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <CalendarCheck2 className="w-3.5 h-3.5" />
                Daily Staff Register
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('apply')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                activeTab === 'apply' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              My Leave &amp; Attendance
            </button>
            {data?.canApproveLeaves && (
              <button
                type="button"
                onClick={() => setActiveTab('approvals')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  activeTab === 'approvals' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Leave Approvals ({pendingCount})
              </button>
            )}
            {data?.canManageRegister && (
              <button
                type="button"
                onClick={() => setActiveTab('balances')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  activeTab === 'balances' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Staff Leave Balances
              </button>
            )}
          </div>
        }
      />

      {feedback && (
        <FeedbackBanner type={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} />
      )}

      {/* Personal Available Leave Balance Strip */}
      {bal && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <KpiMetricCard
            label="Casual Leave (CL) Available"
            value={`${bal.clAvailable} days`}
            subtext={`Used ${bal.clUsed} of ${bal.clTotal} annual CL days`}
            tone={bal.clAvailable <= 2 ? 'warning' : 'positive'}
          />
          <KpiMetricCard
            label="Medical Leave (ML) Available"
            value={`${bal.mlAvailable} days`}
            subtext={`Used ${bal.mlUsed} of ${bal.mlTotal} annual ML days`}
            tone="accent"
          />
          <KpiMetricCard
            label="Academic Duty (OD) Available"
            value={`${bal.odAvailable} days`}
            subtext={`Used ${bal.odUsed} of ${bal.odTotal} annual OD days`}
            tone="neutral"
          />
          <KpiMetricCard
            label="Total Leave Days Remaining"
            value={`${bal.totalAvailable} / ${bal.totalAllocated}`}
            subtext={`${bal.totalUsed} total days availed in AY 2026–27`}
            tone="positive"
          />
        </div>
      )}

      {/* TAB 1: HOD / Admin Daily Staff Attendance Register */}
      {activeTab === 'register' && data?.canManageRegister && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Department Daily Staff Attendance Register</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mark daily attendance for teaching faculty and non-teaching laboratory staff
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  void loadData(e.target.value);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
              />
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveRegister}
                className="px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                {saving ? 'Saving...' : 'Save Daily Register'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-4">Staff Member</th>
                  <th className="py-2.5 px-3">Available Leave</th>
                  <th className="py-2.5 px-3">Attendance Status</th>
                  <th className="py-2.5 px-3">Check-In</th>
                  <th className="py-2.5 pl-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.staffRegister.map((row) => {
                  const current = registerDraft[row.staffId] || {
                    status: row.status,
                    checkInTime: row.checkInTime,
                    remarks: row.remarks,
                  };
                  return (
                    <tr key={row.staffId} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900">{row.fullName}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.staffCode} · {row.designation} · {row.category === 'TEACHING' ? 'Teaching' : 'Non-Teaching'}
                        </div>
                      </td>
                      <td className="py-3 px-3 tabular-nums text-slate-700 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{row.leaveBalance.totalAvailable}d left</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="text-[11px] text-slate-500">
                          CL {row.leaveBalance.clAvailable} · ML {row.leaveBalance.mlAvailable} · OD {row.leaveBalance.odAvailable}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                          {ATTENDANCE_STATUSES.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setRegisterDraft((prev) => ({
                                  ...prev,
                                  [row.staffId]: { ...current, status: opt.value },
                                }))
                              }
                              className={`px-2 py-1 text-[11px] font-medium rounded cursor-pointer whitespace-nowrap ${
                                current.status === opt.value
                                  ? opt.value === 'ABSENT'
                                    ? 'bg-red-700 text-white'
                                    : opt.value === 'ON_LEAVE'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-blue-700 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="time"
                          value={current.checkInTime}
                          disabled={current.status === 'ABSENT' || current.status === 'ON_LEAVE'}
                          onChange={(e) =>
                            setRegisterDraft((prev) => ({
                              ...prev,
                              [row.staffId]: { ...current, checkInTime: e.target.value },
                            }))
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </td>
                      <td className="py-3 pl-3">
                        <input
                          type="text"
                          placeholder="Optional note..."
                          value={current.remarks}
                          onChange={(e) =>
                            setRegisterDraft((prev) => ({
                              ...prev,
                              [row.staffId]: { ...current, remarks: e.target.value },
                            }))
                          }
                          className="w-full min-w-[140px] rounded border border-slate-300 px-2.5 py-1 text-xs"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Apply for Leave + My Attendance History */}
      {activeTab === 'apply' && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-slate-900">Apply for Staff Leave</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Your remaining leave balance is validated before submission and deducted upon HOD approval.
            </p>

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Leave Type</label>
                  <select
                    value={leaveForm.leaveCategory}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, leaveCategory: e.target.value as LeaveCategory })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="CL">Casual Leave (CL — {bal?.clAvailable ?? 0}d left)</option>
                    <option value="ML">Medical Leave (ML — {bal?.mlAvailable ?? 0}d left)</option>
                    <option value="OD">Academic Duty (OD — {bal?.odAvailable ?? 0}d left)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">From Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.fromDate}
                    onChange={(e) =>
                      setLeaveForm({
                        ...leaveForm,
                        fromDate: e.target.value,
                        toDate: e.target.value > leaveForm.toDate ? e.target.value : leaveForm.toDate,
                      })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">To Date</label>
                  <input
                    type="date"
                    required
                    min={leaveForm.fromDate}
                    value={leaveForm.toDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-xs">
                <span className="text-slate-600">
                  Duration: <strong className="text-slate-900 tabular-nums">{requestedDays} day(s)</strong>
                </span>
                <span
                  className={`font-medium tabular-nums ${
                    requestedDays > categoryAvailable ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  Available {leaveForm.leaveCategory}: {categoryAvailable} day(s)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Leave Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Personal leave / Medical checkup / External examiner duty"
                  value={leaveForm.title}
                  onChange={(e) => setLeaveForm({ ...leaveForm, title: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason &amp; Class / Lab Substitution Arrangement
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify alternate faculty or lab staff covering your scheduled hours..."
                  value={leaveForm.description}
                  onChange={(e) => setLeaveForm({ ...leaveForm, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={saving || requestedDays > categoryAvailable}
                className="w-full rounded-md bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-medium py-2.5 px-4 cursor-pointer"
              >
                {saving ? 'Submitting...' : `Submit ${leaveForm.leaveCategory} Leave Request (${requestedDays} day)`}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            {/* My Leave Requests */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">My Leave Applications</h3>
              {data.staffLeaveRequests.filter((r) => r.staffId === user?.staffId).length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No staff leave requests submitted yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.staffLeaveRequests
                    .filter((r) => r.staffId === user?.staffId)
                    .map((req) => (
                      <div key={req.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-900">
                            {req.leaveCategory || 'CL'} · {req.daysCount || 1} day(s) — {req.title}
                          </span>
                          <StatusLabel status={req.status} />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {req.requestNumber} · {req.fromDate} to {req.toDate || req.fromDate}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* My Daily Attendance Log */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">My Daily Attendance History</h3>
              {data.myAttendanceHistory.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No daily attendance logs recorded yet.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-medium">
                      <th className="py-2">Date</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Check-In</th>
                      <th className="py-2">Verified By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.myAttendanceHistory.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2.5 tabular-nums font-medium text-slate-900">{row.date}</td>
                        <td className="py-2.5">
                          <StatusLabel status={row.status} />
                        </td>
                        <td className="py-2.5 tabular-nums text-slate-600">{row.checkInTime || '—'}</td>
                        <td className="py-2.5 text-slate-500">{row.markedByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HOD / Admin Leave Approval Queue */}
      {activeTab === 'approvals' && data?.canApproveLeaves && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-900">Department Staff Leave Approvals</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-5">
            Inspect requested leave duration against each staff member&apos;s available leave days before approving.
          </p>

          {data.staffLeaveRequests.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">No staff leave requests in this department.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.staffLeaveRequests.map((req) => {
                const actionable = req.status === 'SUBMITTED' || req.status === 'UNDER_REVIEW';
                const cat = req.leaveCategory || 'CL';
                const reqDays = req.daysCount || 1;
                const availForCat = req.requesterBalance
                  ? cat === 'CL'
                    ? req.requesterBalance.clAvailable
                    : cat === 'ML'
                    ? req.requesterBalance.mlAvailable
                    : req.requesterBalance.odAvailable
                  : 0;

                return (
                  <div key={req.id} className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">{req.requesterName}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-blue-700 font-medium">{req.requestNumber}</span>
                        <span className="text-slate-400">·</span>
                        <StatusLabel status={req.status} />
                      </div>
                      <div className="text-sm font-medium text-slate-900">{req.title}</div>
                      <p className="text-xs text-slate-600">{req.description}</p>
                      <div className="text-xs text-slate-500 tabular-nums pt-0.5">
                        Dates: <span className="text-slate-800 font-medium">{req.fromDate}</span> to{' '}
                        <span className="text-slate-800 font-medium">{req.toDate || req.fromDate}</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        Requested: <span className="text-slate-900 font-semibold">{reqDays} day(s) ({cat})</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        Available Balance:{' '}
                        <span className={`font-semibold ${reqDays > availForCat ? 'text-red-700' : 'text-emerald-700'}`}>
                          {availForCat} {cat} days remaining
                        </span>
                      </div>
                    </div>

                    {actionable && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={saving || reqDays > availForCat}
                          onClick={() => handleDecision(req.id, 'APPROVED')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve &amp; Deduct ({reqDays}d)
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleDecision(req.id, 'REJECTED')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-red-300 bg-white hover:bg-red-50 text-red-700 text-xs font-medium cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Department Staff Leave Balance Ledger */}
      {activeTab === 'balances' && data?.canManageRegister && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-slate-900">Department Staff Leave Balance Ledger (AY 2026–27)</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-5">
            Complete annual entitlement, days availed, and remaining available leave days per staff member
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2.5 pr-4">Staff Code</th>
                  <th className="py-2.5 px-3">Name &amp; Designation</th>
                  <th className="py-2.5 px-3 text-right">Casual Leave (CL)</th>
                  <th className="py-2.5 px-3 text-right">Medical Leave (ML)</th>
                  <th className="py-2.5 px-3 text-right">Academic Duty (OD)</th>
                  <th className="py-2.5 pl-3 text-right">Total Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.staffRegister.map((row) => {
                  const b = row.leaveBalance;
                  return (
                    <tr key={row.staffId} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 text-slate-600">{row.staffCode}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900">{row.fullName}</div>
                        <div className="text-[11px] text-slate-500">{row.designation}</div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span className="font-semibold text-slate-900">{b.clAvailable}</span> / {b.clTotal} avail
                        <div className="text-[11px] text-slate-400">{b.clUsed} used</div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span className="font-semibold text-slate-900">{b.mlAvailable}</span> / {b.mlTotal} avail
                        <div className="text-[11px] text-slate-400">{b.mlUsed} used</div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span className="font-semibold text-slate-900">{b.odAvailable}</span> / {b.odTotal} avail
                        <div className="text-[11px] text-slate-400">{b.odUsed} used</div>
                      </td>
                      <td className="py-3 pl-3 text-right tabular-nums">
                        <span className="text-sm font-semibold text-emerald-700">{b.totalAvailable} days</span>
                        <div className="text-[11px] text-slate-400">of {b.totalAllocated} total</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
