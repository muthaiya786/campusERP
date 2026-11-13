import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  CalendarCheck2,
  CheckSquare,
  ClipboardList,
  Megaphone,
  TrendingUp,
} from 'lucide-react';
import { KpiMetricCard, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface StudentDashboardPayload {
  portalMode: 'STUDENT';
  department: { id: string; code: string; name: string };
  student: {
    id: string;
    registerNumber: string;
    fullName: string;
    semester: number;
    cgpa: number;
    email: string;
  };
  programmeName: string;
  sectionName: string;
  attendanceThresholdPct: number;
  overallAttendance: { total: number; attended: number; onDuty: number; absent: number; percentage: number };
  subjectAttendance: {
    subjectId: string;
    code: string;
    title: string;
    total: number;
    attended: number;
    percentage: number;
  }[];
  todaySlots: {
    id: string;
    day: string;
    period: number;
    startTime: string;
    endTime: string;
    roomCode: string;
    subjectCode: string;
    subjectTitle: string;
    facultyName: string;
    slotType: string;
  }[];
  pendingAssignments: {
    id: string;
    title: string;
    subjectCode: string;
    dueDate: string;
    maxMarks: number;
    submissionStatus: string;
    marks?: number;
  }[];
  publishedAssessments: {
    id: string;
    title: string;
    componentType: string;
    maxMarks: number;
    scoredMarks: number | null;
    passMarks: number;
    examDate: string;
  }[];
  feeBalance: number;
  myRequests: { id: string; requestNumber: string; title: string; type: string; status: string }[];
  announcements: { id: string; title: string; body: string; authorName: string; createdAt: string }[];
  openPlacements: { id: string; companyName: string; roleTitle: string; packageLpa: number; driveDate: string }[];
}

interface StaffDashboardPayload {
  portalMode: 'FACULTY' | 'HOD' | 'ADMIN';
  department: { id: string; code: string; name: string };
  attendanceThresholdPct: number;
  kpis: {
    totalStudents: number;
    totalStaff: number;
    teachingStaff: number;
    activeSubjects: number;
    avgAttendancePct: number;
    shortageCount: number;
    avgSyllabusPct: number;
    pendingApprovalsCount: number;
    pendingMarksCount: number;
    iqacReadinessPct: number;
    activeDepartmentsCount: number;
    totalUsersCount: number;
  };
  shortageStudents: {
    studentId: string;
    registerNumber: string;
    fullName: string;
    percentage: number;
    attended: number;
    total: number;
  }[];
  syllabusMetrics: {
    subjectId: string;
    code: string;
    title: string;
    facultyName: string;
    completedTopics: number;
    totalTopics: number;
    completionPct: number;
  }[];
  myTimetable: {
    id: string;
    day: string;
    period: number;
    startTime: string;
    endTime: string;
    roomCode: string;
    subjectCode: string;
    subjectTitle: string;
    sectionName: string;
    slotType: string;
  }[];
  pendingRequests: {
    id: string;
    requestNumber: string;
    requesterName: string;
    type: string;
    title: string;
    status: string;
  }[];
  pendingAssessments: {
    id: string;
    title: string;
    status: string;
    examDate: string;
  }[];
  announcements: { id: string; title: string; body: string; authorName: string; createdAt: string }[];
  recentAuditLogs: { id: string; timestamp: string; actorName: string; action: string; summary: string }[];
  calendarItems: { id: string; date: string; title: string; type: string }[];
  myLeaveBalance?: {
    staffId: string;
    academicYear: string;
    clAvailable: number;
    clTotal: number;
    mlAvailable: number;
    mlTotal: number;
    odAvailable: number;
    odTotal: number;
    totalAvailable: number;
    totalAllocated: number;
  } | null;
  staffSummary?: {
    latestDate: string;
    presentToday: number;
    totalStaff: number;
    pendingStaffLeaveCount: number;
  };
}

type DashboardResponse = StudentDashboardPayload | StaffDashboardPayload;

export function DashboardPage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { user, selectedDepartmentId } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<DashboardResponse>(`/dashboard?departmentId=${encodeURIComponent(selectedDepartmentId)}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedDepartmentId, user?.id]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-14 bg-white border border-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (data.portalMode === 'STUDENT') {
    const isShortage = data.overallAttendance.percentage < data.attendanceThresholdPct;
    return (
      <div>
        <PageHeader
          title={`Welcome back, ${data.student.fullName}`}
          subtitle={`${data.student.registerNumber} · ${data.programmeName} · ${data.sectionName} · ${data.department.name}`}
          actions={
            <button
              type="button"
              onClick={() => onNavigate('requests')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer whitespace-nowrap"
            >
              Submit Leave / OD / Certificate
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <KpiMetricCard
            label="Overall Attendance"
            value={`${data.overallAttendance.percentage}%`}
            subtext={`${data.overallAttendance.attended}/${data.overallAttendance.total} sessions · Policy min ${data.attendanceThresholdPct}%`}
            tone={isShortage ? 'danger' : 'positive'}
            onClick={() => onNavigate('attendance')}
            actionLabel="Details"
          />
          <KpiMetricCard
            label="Cumulative GPA"
            value={data.student.cgpa.toFixed(2)}
            subtext={`${data.publishedAssessments.length} published assessment(s) this term`}
            tone="accent"
            onClick={() => onNavigate('assessments')}
            actionLabel="Marks"
          />
          <KpiMetricCard
            label="Pending Assignments"
            value={data.pendingAssignments.filter((a) => a.submissionStatus === 'PENDING').length}
            subtext={`${data.pendingAssignments.length} total active coursework items`}
            tone="warning"
            onClick={() => onNavigate('assignments')}
            actionLabel="Submit"
          />
          <KpiMetricCard
            label="Fee Balance Due"
            value={`₹${data.feeBalance.toLocaleString('en-IN')}`}
            subtext={data.feeBalance === 0 ? 'All semester dues cleared' : 'Payable online with instant receipt'}
            tone={data.feeBalance > 0 ? 'warning' : 'positive'}
            onClick={() => onNavigate('fees')}
            actionLabel="Pay / Receipt"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Subject Attendance */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Subject-Wise Attendance Tracker</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculated transparently from verified faculty registers
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                View Full Register
              </button>
            </div>
            <div className="space-y-3.5">
              {data.subjectAttendance.map((sub) => (
                <div key={sub.subjectId}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-800">
                      <span className="font-mono text-slate-500 mr-1.5">{sub.code}</span>
                      {sub.title}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {sub.percentage}% ({sub.attended}/{sub.total})
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${
                        sub.percentage < data.attendanceThresholdPct ? 'bg-red-600' : 'bg-blue-700'
                      }`}
                      style={{ width: `${Math.min(100, sub.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timetable Preview */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Weekly Class Schedule</h2>
              <button
                type="button"
                onClick={() => onNavigate('timetable')}
                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                Full Grid
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {data.todaySlots.map((slot) => (
                <div key={slot.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">
                      {slot.subjectCode} · {slot.subjectTitle}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {slot.day} · {slot.startTime}–{slot.endTime} · {slot.roomCode}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">P{slot.period}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Published Marks */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Published Internal Assessment Results</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Only HOD-published assessments are visible in Student Portal
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('assessments')}
                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                All Results
              </button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2">Assessment</th>
                  <th className="py-2 text-right">Score</th>
                  <th className="py-2 pl-4">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {data.publishedAssessments.map((asm) => {
                  const passed = (asm.scoredMarks ?? 0) >= asm.passMarks;
                  return (
                    <tr key={asm.id}>
                      <td className="py-2.5 font-medium text-slate-900 text-xs">{asm.title}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-xs font-semibold">
                        {asm.scoredMarks ?? '—'} / {asm.maxMarks}
                      </td>
                      <td className="py-2.5 pl-4">
                        <StatusLabel status={passed ? 'VERIFIED' : 'ABSENT'} label={passed ? 'Pass' : 'Reappear'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Announcements & Placement Drives */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Department Notices</h2>
                <span className="text-xs text-slate-500">{data.announcements.length} active</span>
              </div>
              <div className="space-y-3">
                {data.announcements.slice(0, 2).map((ann) => (
                  <div key={ann.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                    <div className="text-xs font-semibold text-slate-900">{ann.title}</div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{ann.body}</p>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {ann.authorName} · {ann.createdAt.slice(0, 10)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {data.openPlacements.length > 0 && (
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-900">Open Placement Drives</h3>
                  <button
                    type="button"
                    onClick={() => onNavigate('operations')}
                    className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    Apply in Career Hub
                  </button>
                </div>
                <div className="space-y-2">
                  {data.openPlacements.map((job) => (
                    <div key={job.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-3 py-2">
                      <span className="font-medium text-slate-900">
                        {job.companyName} — {job.roleTitle}
                      </span>
                      <span className="font-mono text-emerald-700 font-medium">{job.packageLpa} LPA</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Faculty / Non-Teaching / HOD / Admin Dashboard
  const isNonTeaching =
    user?.roles.includes('NON_TEACHING_STAFF') && !user?.roles.includes('FACULTY');

  const titleByMode =
    data.portalMode === 'ADMIN'
      ? 'Institution Administration & Multi-Department Oversight'
      : isNonTeaching
      ? `Laboratory & Technical Operations · ${data.department.code}`
      : data.portalMode === 'HOD'
      ? `HOD Command Center · ${data.department.name}`
      : `Faculty Teaching Workspace · ${data.department.code}`;

  const staffLeaveRoute =
    data.portalMode === 'ADMIN'
      ? 'adm_staff_attendance'
      : data.portalMode === 'HOD'
      ? 'hod_staff_attendance'
      : isNonTeaching
      ? 'lab_staff_attendance'
      : 'fac_staff_attendance';

  return (
    <div>
      <PageHeader
        title={titleByMode}
        subtitle={`Real-time academic telemetry, syllabus velocity, and approval queues for ${data.department.name} (${data.department.code})`}
        actions={
          <>
            {data.portalMode === 'ADMIN' ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('adm_bi')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-blue-700" />
                  Executive BI Analytics
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate(staffLeaveRoute)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  <CalendarCheck2 className="w-3.5 h-3.5 text-blue-700" />
                  Staff Attendance &amp; Leave
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('adm_departments')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer whitespace-nowrap"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  Manage / Add Departments ({data.kpis.activeDepartmentsCount})
                </button>
              </>
            ) : isNonTeaching ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate(staffLeaveRoute)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  <CalendarCheck2 className="w-3.5 h-3.5 text-blue-700" />
                  My Attendance &amp; Leave
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('lab_assets')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer whitespace-nowrap"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Manage Laboratories &amp; Assets
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate(staffLeaveRoute)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  <CalendarCheck2 className="w-3.5 h-3.5 text-blue-700" />
                  Staff Attendance &amp; Leave
                </button>
                {data.portalMode === 'HOD' && (
                  <button
                    type="button"
                    onClick={() => onNavigate('hod_bi')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-blue-700" />
                    Department BI Reports
                  </button>
                )}
                {data.portalMode === 'FACULTY' ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('fac_attendance')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer whitespace-nowrap"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Mark Class Attendance
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate('hod_requests')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer whitespace-nowrap"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Review Approvals ({data.kpis.pendingApprovalsCount})
                  </button>
                )}
              </>
            )}
          </>
        }
      />

      {/* Executive KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {data.portalMode === 'ADMIN' ? (
          <KpiMetricCard
            label="Active Departments"
            value={data.kpis.activeDepartmentsCount}
            subtext={`${data.kpis.totalUsersCount} user accounts · Add departments anytime`}
            tone="accent"
            onClick={() => onNavigate('adm_departments')}
            actionLabel="Manage"
          />
        ) : (
          <KpiMetricCard
            label="Active Students & Faculty"
            value={`${data.kpis.totalStudents} / ${data.kpis.totalStaff}`}
            subtext={`${data.kpis.activeSubjects} mapped subjects in ${data.department.code}`}
            tone="accent"
            onClick={() => onNavigate('students')}
            actionLabel="Directory"
          />
        )}
        <KpiMetricCard
          label="Department Attendance"
          value={`${data.kpis.avgAttendancePct}%`}
          subtext={`${data.kpis.shortageCount} student(s) below ${data.attendanceThresholdPct}% policy`}
          tone={data.kpis.shortageCount > 0 ? 'warning' : 'positive'}
          onClick={() => onNavigate(isNonTeaching ? 'lab_timetable' : 'attendance')}
          actionLabel={isNonTeaching ? 'Schedule' : 'Attendance'}
        />
        <KpiMetricCard
          label="Syllabus & Marks Pipeline"
          value={`${data.kpis.avgSyllabusPct}%`}
          subtext={`${data.kpis.pendingMarksCount} assessment(s) awaiting verification/publish`}
          tone="neutral"
          onClick={() => onNavigate(isNonTeaching ? 'lab_assets' : 'assessments')}
          actionLabel={isNonTeaching ? 'Labs' : 'Marks'}
        />
        <KpiMetricCard
          label="Approvals & IQAC Readiness"
          value={`${data.kpis.pendingApprovalsCount} pending`}
          subtext={`IQAC/NBA evidence completion at ${data.kpis.iqacReadinessPct}%`}
          tone={data.kpis.pendingApprovalsCount > 0 ? 'warning' : 'positive'}
          onClick={() => onNavigate(data.portalMode === 'ADMIN' ? 'adm_requests' : 'operations')}
          actionLabel="Inspect"
        />
      </div>

      {/* Staff Attendance & Leave Balance Summary Strip */}
      {(data.myLeaveBalance || data.staffSummary) && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            {data.myLeaveBalance && (
              <div>
                <div className="text-xs font-medium text-slate-500">My Available Leave Balance</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">
                  {data.myLeaveBalance.totalAvailable} of {data.myLeaveBalance.totalAllocated} days available
                  <span className="text-xs font-normal text-slate-600 ml-2">
                    (CL: {data.myLeaveBalance.clAvailable} · ML: {data.myLeaveBalance.mlAvailable} · OD: {data.myLeaveBalance.odAvailable})
                  </span>
                </div>
              </div>
            )}
            {data.staffSummary && (
              <div className={data.myLeaveBalance ? 'md:border-l md:border-slate-200 md:pl-6' : ''}>
                <div className="text-xs font-medium text-slate-500">
                  Department Staff Attendance ({data.staffSummary.latestDate})
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">
                  {data.staffSummary.presentToday} / {data.staffSummary.totalStaff} staff present
                  {data.staffSummary.pendingStaffLeaveCount > 0 && (
                    <span className="text-xs font-medium text-amber-700 ml-2">
                      · {data.staffSummary.pendingStaffLeaveCount} leave request(s) awaiting approval
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate(staffLeaveRoute)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-800 cursor-pointer whitespace-nowrap w-fit"
          >
            <CalendarCheck2 className="w-3.5 h-3.5 text-blue-700" />
            {data.portalMode === 'HOD' || data.portalMode === 'ADMIN'
              ? 'Mark Staff Attendance & Approve Leave'
              : 'Apply Leave & View Balance'}
          </button>
        </div>
      )}

      {/* Main Two-Column Operational Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Syllabus Completion & Timetable */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Syllabus Completion &amp; Teaching Progress
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live topic completion across active department courses
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('academics')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
            >
              Update Progress <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3.5">
            {data.syllabusMetrics.map((sub) => (
              <div key={sub.subjectId}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="truncate pr-3">
                    <span className="font-mono text-slate-500 mr-1.5">{sub.code}</span>
                    <span className="font-medium text-slate-900">{sub.title}</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-500">{sub.facultyName}</span>
                  </div>
                  <span className="font-mono tabular-nums font-medium text-slate-800 shrink-0">
                    {sub.completionPct}% ({sub.completedTopics}/{sub.totalTopics})
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                  <div className="h-full bg-blue-700" style={{ width: `${sub.completionPct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approval Queue */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Pending Action Queue</h2>
            <button
              type="button"
              onClick={() => onNavigate('requests')}
              className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
            >
              Open Centre
            </button>
          </div>
          {data.pendingRequests.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No pending approval requests.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.pendingRequests.map((req) => (
                <div key={req.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-500">{req.requestNumber}</span>
                    <StatusLabel status={req.status} />
                  </div>
                  <div className="text-xs font-medium text-slate-900 mt-1">{req.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {req.requesterName} · {req.type.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom 3-Column Strip: Shortage Watchlist, Calendar & Audit Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Shortage List */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Attendance Shortage (&lt;{data.attendanceThresholdPct}%)
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('attendance')}
              className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
            >
              Manage
            </button>
          </div>
          {data.shortageStudents.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">All students meet minimum attendance threshold.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.shortageStudents.map((st) => (
                <div key={st.studentId} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-slate-900">{st.fullName}</div>
                    <div className="font-mono text-slate-500">{st.registerNumber}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-semibold text-red-700">{st.percentage}%</div>
                    <div className="text-[11px] text-slate-400">
                      {st.attended}/{st.total} cls
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Academic Calendar & Notices */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Academic Calendar Milestones</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.calendarItems.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-800 font-medium">{item.title}</span>
                <span className="font-mono text-slate-500 shrink-0">{item.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Announcements + Audit Snapshot */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">Latest Circulars &amp; Activity</h2>
            </div>
          </div>
          <div className="space-y-3">
            {data.announcements.slice(0, 2).map((ann) => (
              <div key={ann.id} className="border-b border-slate-100 pb-2.5">
                <div className="text-xs font-medium text-slate-900">{ann.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {ann.authorName} · {ann.createdAt.slice(0, 10)}
                </div>
              </div>
            ))}
            {data.recentAuditLogs.slice(0, 2).map((log) => (
              <div key={log.id} className="text-[11px] text-slate-500">
                <span className="font-mono text-slate-700">{log.action}</span> — {log.summary}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
