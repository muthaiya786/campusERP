import React, { useCallback, useEffect, useState } from 'react';
import { Download, Filter, Printer, Search } from 'lucide-react';
import {
  BiDonutBreakdownChart,
  BiGroupedBarChart,
  BiHorizontalWorkloadChart,
  BiTrendAreaChart,
} from '../components/bi/BiCharts';
import { KpiMetricCard, PageHeader, StatusLabel } from '../components/ui/DataUi';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface BiResponse {
  filters: {
    departmentId: string;
    yearOfStudy: number | null;
    semester: number | null;
    sectionId: string | null;
  };
  thresholdPct: number;
  summary: {
    totalStudents: number;
    avgCgpa: number;
    avgAttendancePct: number;
    shortageCount: number;
    placementEligibleApplicants: number;
    placedStudents: number;
    iqacAvgCompletionPct: number;
  };
  yearWiseBreakdown: {
    yearOfStudy: number;
    yearLabel: string;
    studentCount: number;
    avgAttendancePct: number;
    avgCgpa: number;
    shortageCount: number;
  }[];
  departmentComparison: {
    departmentId: string;
    code: string;
    name: string;
    studentCount: number;
    staffCount: number;
    avgAttendancePct: number;
    avgCgpa: number;
    staffAttendancePct: number;
  }[];
  attendanceTrend: {
    date: string;
    label: string;
    attendancePct: number;
    present: number;
    onDuty: number;
    absent: number;
    total: number;
  }[];
  sectionBreakdown: {
    sectionId: string;
    sectionName: string;
    departmentCode: string;
    semester: number;
    yearOfStudy: number;
    studentCount: number;
    avgAttendancePct: number;
    avgCgpa: number;
  }[];
  subjectPerformance: {
    assessmentId: string;
    title: string;
    subjectCode: string;
    componentType: string;
    status: string;
    passRatePct: number;
    avgScorePct: number;
    highScore: number;
    maxMarks: number;
  }[];
  gradeDistribution: { band: string; count: number; color: string }[];
  facultyWorkload: {
    staffId: string;
    fullName: string;
    designation: string;
    theoryHours: number;
    labHours: number;
    totalAssignedHours: number;
    weeklyMaxHours: number;
    syllabusCompletionPct: number;
    publications: number;
  }[];
  feeSummary: {
    totalBilled: number;
    concessions: number;
    collected: number;
    pending: number;
  };
  iqacItems: {
    id: string;
    framework: string;
    criterionCode: string;
    criterionTitle: string;
    completionPct: number;
    status: string;
  }[];
  riskMatrix: {
    studentId: string;
    registerNumber: string;
    fullName: string;
    departmentCode: string;
    yearOfStudy: number;
    yearLabel: string;
    semester: number;
    sectionName: string;
    attendancePct: number;
    cgpa: number;
    feeDue: number;
    riskLevel: string;
  }[];
}

export function BIReportsPage({
  onNavigate,
}: {
  onNavigate: (tab: string) => void;
}) {
  const { user, selectedDepartmentId, departments, can } = useAuth();
  const isInstAdmin = Boolean(
    user?.roles.includes('SUPER_ADMIN') ||
      user?.roles.includes('COLLEGE_ADMIN') ||
      user?.roles.includes('PRINCIPAL')
  );

  const [reportTab, setReportTab] = useState<'year_dept' | 'overview' | 'academics' | 'workload' | 'risk'>('year_dept');
  const [biDeptId, setBiDeptId] = useState<string>(selectedDepartmentId);
  const [yearOfStudy, setYearOfStudy] = useState<string>('');
  const [semester, setSemester] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH_RISK' | 'WATCH' | 'NOMINAL'>('ALL');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<BiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBiDeptId(selectedDepartmentId);
  }, [selectedDepartmentId]);

  const loadBi = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetDept = isInstAdmin ? biDeptId : user?.departmentId || selectedDepartmentId;
      const params = new URLSearchParams({ departmentId: targetDept });
      if (yearOfStudy) params.set('yearOfStudy', yearOfStudy);
      if (semester) params.set('semester', semester);
      if (sectionId) params.set('sectionId', sectionId);
      const res = await apiRequest<BiResponse>(`/bi/reports?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load BI analytics');
    } finally {
      setLoading(false);
    }
  }, [isInstAdmin, biDeptId, user?.departmentId, selectedDepartmentId, yearOfStudy, semester, sectionId]);

  useEffect(() => {
    void loadBi();
  }, [loadBi]);

  const exportCsv = () => {
    if (!data) return;
    const headers = [
      'Department',
      'Year',
      'Semester',
      'Register Number',
      'Student Name',
      'Section',
      'Attendance %',
      'CGPA',
      'Fee Due (INR)',
      'Risk Status',
    ];
    const rows = data.riskMatrix.map((r) => [
      r.departmentCode,
      `"${r.yearLabel}"`,
      r.semester,
      r.registerNumber,
      `"${r.fullName}"`,
      `"${r.sectionName}"`,
      r.attendancePct,
      r.cgpa,
      r.feeDue,
      r.riskLevel,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BI_Report_${biDeptId}${yearOfStudy ? `_Year${yearOfStudy}` : ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deptLabel =
    biDeptId === 'ALL'
      ? 'All Active Departments'
      : departments.find((d) => d.id === biDeptId)?.name || 'Department';
  const yearLabelText = yearOfStudy ? ` · Year ${yearOfStudy}` : ' · All Years (1st–4th)';

  const filteredRisk = (data?.riskMatrix || []).filter((r) => {
    const matchesSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.registerNumber.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === 'ALL' || r.riskLevel === riskFilter;
    return matchesSearch && matchesRisk;
  });

  return (
    <div>
      <PageHeader
        title="BI Analytics & Year-Wise / Department Reports"
        subtitle={`Decision-support intelligence for ${deptLabel}${yearLabelText}`}
        actions={
          <>
            {can('bi_reports', 'export') && (
              <button
                type="button"
                onClick={exportCsv}
                disabled={!data}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md bg-blue-700 hover:bg-blue-800 text-white cursor-pointer whitespace-nowrap shrink-0 no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </button>
          </>
        }
      />

      {/* Unified BI Toolbar: Segmented Report Views + Department & Year Slice Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 space-y-3 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {[
            { id: 'year_dept', label: '01. Year & Dept Reports' },
            { id: 'overview', label: '02. Attendance & CGPA' },
            { id: 'academics', label: '03. Marks & Exams' },
            { id: 'workload', label: '04. Faculty, Fees & IQAC' },
            { id: 'risk', label: '05. Student Roster' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setReportTab(t.id as typeof reportTab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                reportTab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Report Filters:</span>
          </div>

          {isInstAdmin && (
            <select
              value={biDeptId}
              onChange={(e) => {
                setBiDeptId(e.target.value);
                setSectionId('');
              }}
              aria-label="Department filter"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
            >
              <option value="ALL">All Departments (Compare)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={yearOfStudy}
            onChange={(e) => {
              setYearOfStudy(e.target.value);
              setSemester('');
              setSectionId('');
            }}
            aria-label="Year of study filter"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
          >
            <option value="">All Years (1st–4th Year)</option>
            <option value="1">1st Year (Sem I &amp; II)</option>
            <option value="2">2nd Year (Sem III &amp; IV)</option>
            <option value="3">3rd Year (Sem V &amp; VI)</option>
            <option value="4">4th Year (Sem VII &amp; VIII)</option>
          </select>

          <select
            value={semester}
            onChange={(e) => {
              setSemester(e.target.value);
              setSectionId('');
            }}
            aria-label="Semester filter"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
          >
            <option value="">All Semesters</option>
            <option value="1">Semester I</option>
            <option value="3">Semester III</option>
            <option value="5">Semester V</option>
            <option value="7">Semester VII</option>
          </select>

          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            aria-label="Section filter"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
          >
            <option value="">All Sections</option>
            {(data?.sectionBreakdown || []).map((sec) => (
              <option key={sec.sectionId} value={sec.sectionId}>
                {sec.departmentCode ? `${sec.departmentCode} · ` : ''}{sec.sectionName} ({sec.studentCount})
              </option>
            ))}
          </select>

          {(yearOfStudy || semester || sectionId) && (
            <button
              type="button"
              onClick={() => {
                setYearOfStudy('');
                setSemester('');
                setSectionId('');
              }}
              className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
            >
              Reset Slices
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Executive KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <KpiMetricCard
              label="Cohort Attendance Index"
              value={`${data.summary.avgAttendancePct}%`}
              subtext={`${data.summary.shortageCount} student(s) below ${data.thresholdPct}% policy`}
              tone={data.summary.shortageCount > 0 ? 'warning' : 'positive'}
              onClick={() => setReportTab('risk')}
              actionLabel="Student List"
            />
            <KpiMetricCard
              label="Cohort Mean CGPA"
              value={data.summary.avgCgpa.toFixed(2)}
              subtext={`Across ${data.summary.totalStudents} filtered student records`}
              tone="accent"
              onClick={() => setReportTab('academics')}
              actionLabel="Marks BI"
            />
            <KpiMetricCard
              label="Fee Collection Ratio"
              value={
                data.feeSummary.totalBilled > 0
                  ? `${Math.round(
                      (data.feeSummary.collected /
                        Math.max(1, data.feeSummary.totalBilled - data.feeSummary.concessions)) *
                        100
                    )}%`
                  : '100%'
              }
              subtext={`₹${data.feeSummary.collected.toLocaleString('en-IN')} collected · ₹${data.feeSummary.pending.toLocaleString('en-IN')} pending`}
              tone={data.feeSummary.pending > 0 ? 'neutral' : 'positive'}
              onClick={() => setReportTab('workload')}
              actionLabel="Breakdown"
            />
            <KpiMetricCard
              label="IQAC & Placement Readiness"
              value={`${data.summary.iqacAvgCompletionPct}%`}
              subtext={`${data.summary.placedStudents} placed · ${data.summary.placementEligibleApplicants} drive applicants`}
              tone="positive"
              onClick={() => onNavigate('operations')}
              actionLabel="Operations"
            />
          </div>

          {reportTab === 'year_dept' && (
            <div className="space-y-6">
              <BiGroupedBarChart
                title="Year-Wise Academic & Attendance Benchmark (1st Year – 4th Year)"
                subtitle="Attendance percentage vs normalized CGPA index (CGPA × 10) separated by year of study"
                primaryName="Avg Attendance %"
                secondaryName="CGPA Index (×10)"
                data={data.yearWiseBreakdown.map((y) => ({
                  label: y.yearLabel,
                  subLabel: `${y.studentCount} stu`,
                  primaryValue: y.avgAttendancePct,
                  secondaryValue: Math.round(y.avgCgpa * 10),
                }))}
              />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Year-Wise Separate Report Table */}
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Year-Wise Separate Student Report</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Click any year row to filter the entire BI report to that cohort
                      </p>
                    </div>
                    {yearOfStudy && (
                      <button
                        type="button"
                        onClick={() => setYearOfStudy('')}
                        className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                      >
                        Show All Years
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                          <th className="py-2.5 pr-4">Year of Study</th>
                          <th className="py-2.5 px-3 text-right">Students</th>
                          <th className="py-2.5 px-3 text-right">Avg Attendance</th>
                          <th className="py-2.5 px-3 text-right">Mean CGPA</th>
                          <th className="py-2.5 pl-3 text-right">Shortage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {data.yearWiseBreakdown.map((yr) => {
                          const isSelected = yearOfStudy === String(yr.yearOfStudy);
                          return (
                            <tr
                              key={yr.yearOfStudy}
                              onClick={() =>
                                setYearOfStudy(isSelected ? '' : String(yr.yearOfStudy))
                              }
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-3 pr-4 font-medium text-slate-900">{yr.yearLabel}</td>
                              <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                                {yr.studentCount}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-slate-900">
                                {yr.avgAttendancePct}%
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-blue-700 font-semibold">
                                {yr.avgCgpa.toFixed(2)}
                              </td>
                              <td
                                className={`py-3 pl-3 text-right tabular-nums font-medium ${
                                  yr.shortageCount > 0 ? 'text-red-700' : 'text-emerald-700'
                                }`}
                              >
                                {yr.shortageCount}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Department-Wise Separate Report Table */}
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-900">Department-Wise Comparison Report</h3>
                  <p className="text-xs text-slate-500 mt-0.5 mb-4">
                    Student strength, staff count, student attendance %, and daily staff presence per department
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                          <th className="py-2.5 pr-4">Department</th>
                          <th className="py-2.5 px-3 text-right">Students</th>
                          <th className="py-2.5 px-3 text-right">Staff</th>
                          <th className="py-2.5 px-3 text-right">Stu Att %</th>
                          <th className="py-2.5 px-3 text-right">Staff Att %</th>
                          <th className="py-2.5 pl-3 text-right">Mean CGPA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {data.departmentComparison.map((dept) => (
                          <tr
                            key={dept.departmentId}
                            onClick={() => {
                              if (isInstAdmin) setBiDeptId(dept.departmentId);
                            }}
                            className={isInstAdmin ? 'hover:bg-slate-50 cursor-pointer' : 'hover:bg-slate-50'}
                          >
                            <td className="py-3 pr-4">
                              <div className="font-semibold text-slate-900">{dept.code}</div>
                              <div className="text-[11px] text-slate-500">{dept.name}</div>
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-slate-700">{dept.studentCount}</td>
                            <td className="py-3 px-3 text-right tabular-nums text-slate-700">{dept.staffCount}</td>
                            <td className="py-3 px-3 text-right tabular-nums text-slate-900">{dept.avgAttendancePct}%</td>
                            <td className="py-3 px-3 text-right tabular-nums text-emerald-700 font-medium">
                              {dept.staffAttendancePct}%
                            </td>
                            <td className="py-3 pl-3 text-right tabular-nums text-blue-700 font-semibold">
                              {dept.avgCgpa.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportTab === 'overview' && (
            <div className="space-y-6">
              <BiTrendAreaChart
                title="Session-by-Session Attendance Compliance Trend"
                subtitle={`Daily attended + on-duty percentage compared against ${data.thresholdPct}% minimum institutional policy`}
                threshold={data.thresholdPct}
                data={data.attendanceTrend.map((t) => ({
                  label: t.label,
                  value: t.attendancePct,
                  secondaryLabel: `${t.present + t.onDuty}/${t.total} attended`,
                }))}
              />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <BiDonutBreakdownChart
                  title="Cohort CGPA Standing Breakdown"
                  subtitle="Distribution of students across institutional grade classifications"
                  centerLabel="Students"
                  centerValue={data.summary.totalStudents}
                  segments={data.gradeDistribution.map((g) => ({
                    label: g.band,
                    value: g.count,
                    color: g.color,
                  }))}
                />

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-900">Section-Wise Academic Benchmark</h3>
                  <p className="text-xs text-slate-500 mt-0.5 mb-5">
                    Comparative cohort strength, mean attendance, and CGPA per section
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                          <th className="py-2.5 pr-4">Section</th>
                          <th className="py-2.5 px-3 text-right">Year</th>
                          <th className="py-2.5 px-3 text-right">Headcount</th>
                          <th className="py-2.5 px-3 text-right">Avg Attendance</th>
                          <th className="py-2.5 pl-3 text-right">Mean CGPA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {data.sectionBreakdown.map((sec) => (
                          <tr key={sec.sectionId} className="hover:bg-slate-50">
                            <td className="py-3 pr-4 font-medium text-slate-900">
                              {sec.departmentCode ? `${sec.departmentCode} · ` : ''}
                              {sec.sectionName}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-slate-500">
                              Year {sec.yearOfStudy}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                              {sec.studentCount}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-slate-900">
                              {sec.avgAttendancePct}%
                            </td>
                            <td className="py-3 pl-3 text-right tabular-nums text-blue-700 font-semibold">
                              {sec.avgCgpa.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportTab === 'academics' && (
            <div className="space-y-6">
              <BiGroupedBarChart
                title="Internal Assessment Performance by Course & Cycle"
                subtitle="Pass percentage vs cohort mean score across published and submitted CIA assessments"
                primaryName="Pass Rate %"
                secondaryName="Mean Score %"
                data={data.subjectPerformance.map((s) => ({
                  label: s.subjectCode,
                  subLabel: s.componentType.replace('_', '-'),
                  primaryValue: s.passRatePct,
                  secondaryValue: s.avgScorePct,
                }))}
              />

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-slate-900">Assessment Ledger Summary</h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  Detailed pass rate, average score, highest mark, and publication workflow status
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                        <th className="py-2.5 pr-4">Course</th>
                        <th className="py-2.5 px-3">Assessment</th>
                        <th className="py-2.5 px-3 text-right">Pass Rate</th>
                        <th className="py-2.5 px-3 text-right">Mean Score</th>
                        <th className="py-2.5 px-3 text-right">Highest</th>
                        <th className="py-2.5 pl-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {data.subjectPerformance.map((s) => (
                        <tr key={s.assessmentId} className="hover:bg-slate-50">
                          <td className="py-3 pr-4 font-semibold text-blue-700">{s.subjectCode}</td>
                          <td className="py-3 px-3 font-medium text-slate-900">{s.title}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-900">{s.passRatePct}%</td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-700">{s.avgScorePct}%</td>
                          <td className="py-3 px-3 text-right tabular-nums text-emerald-700 font-medium">
                            {s.highScore} / {s.maxMarks}
                          </td>
                          <td className="py-3 pl-3">
                            <StatusLabel status={s.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportTab === 'workload' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <BiHorizontalWorkloadChart
                  title="Faculty Teaching Load & Syllabus Velocity"
                  subtitle="Weekly theory & lab hours vs maximum capacity, paired with unit completion %"
                  items={data.facultyWorkload.map((f) => ({
                    name: f.fullName,
                    roleNote: f.designation,
                    theoryHours: f.theoryHours,
                    labHours: f.labHours,
                    maxHours: f.weeklyMaxHours,
                    syllabusPct: f.syllabusCompletionPct,
                  }))}
                />

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-900">Fee Collection &amp; Scholarship Summary</h3>
                  <p className="text-xs text-slate-500 mt-0.5 mb-5">
                    Department fee ledger reconciliation for active academic term
                  </p>
                  <dl className="divide-y divide-slate-100 text-sm">
                    <div className="py-3 flex justify-between">
                      <dt className="text-slate-600">Gross Tuition &amp; Lab Billed</dt>
                      <dd className="tabular-nums font-medium text-slate-900">
                        ₹{data.feeSummary.totalBilled.toLocaleString('en-IN')}
                      </dd>
                    </div>
                    <div className="py-3 flex justify-between">
                      <dt className="text-slate-600">Approved Scholarships / Concessions</dt>
                      <dd className="tabular-nums font-medium text-blue-700">
                        - ₹{data.feeSummary.concessions.toLocaleString('en-IN')}
                      </dd>
                    </div>
                    <div className="py-3 flex justify-between">
                      <dt className="text-slate-600">Net Collected (Verified Receipts)</dt>
                      <dd className="tabular-nums font-semibold text-emerald-700">
                        ₹{data.feeSummary.collected.toLocaleString('en-IN')}
                      </dd>
                    </div>
                    <div className="py-3 flex justify-between">
                      <dt className="text-slate-900 font-medium">Outstanding Balance Due</dt>
                      <dd className="tabular-nums font-semibold text-amber-700">
                        ₹{data.feeSummary.pending.toLocaleString('en-IN')}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-slate-900">IQAC / NAAC / NBA Documentation Readiness</h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  Evidence completion and verification progress by criterion
                </p>
                <div className="space-y-4">
                  {data.iqacItems.map((item) => (
                    <div key={item.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-900">
                          <span className="font-semibold text-blue-700 mr-1.5">{item.framework} {item.criterionCode}</span>
                          {item.criterionTitle}
                        </span>
                        <StatusLabel status={item.status} />
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                          <div className="h-full bg-blue-700" style={{ width: `${item.completionPct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-slate-700 w-10 text-right">
                          {item.completionPct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {reportTab === 'risk' && (
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Department &amp; Year-Wise Student Academic Risk Matrix
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Students flagged automatically when attendance &lt; {data.thresholdPct}% or CGPA &lt; 7.00
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 no-print">
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                    {(['ALL', 'HIGH_RISK', 'WATCH', 'NOMINAL'] as const).map((rf) => (
                      <button
                        key={rf}
                        type="button"
                        onClick={() => setRiskFilter(rf)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer ${
                          riskFilter === rf ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {rf === 'ALL' ? 'All' : rf === 'HIGH_RISK' ? 'High Risk' : rf === 'WATCH' ? 'Watch' : 'Nominal'}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search register no or name..."
                      className="w-full rounded-md border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 pr-4">Register No</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Dept &amp; Year</th>
                      <th className="py-2.5 px-3">Section</th>
                      <th className="py-2.5 px-3 text-right">Attendance</th>
                      <th className="py-2.5 px-3 text-right">CGPA</th>
                      <th className="py-2.5 px-3 text-right">Fee Balance</th>
                      <th className="py-2.5 pl-3">Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredRisk.map((row) => (
                      <tr key={row.studentId} className="hover:bg-slate-50">
                        <td className="py-3 pr-4 text-xs font-medium text-slate-700">{row.registerNumber}</td>
                        <td className="py-3 px-3 font-medium text-slate-900">{row.fullName}</td>
                        <td className="py-3 px-3 text-xs text-slate-600">
                          {row.departmentCode} · {row.yearLabel}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600">{row.sectionName}</td>
                        <td
                          className={`py-3 px-3 text-right tabular-nums font-semibold ${
                            row.attendancePct < data.thresholdPct ? 'text-red-700' : 'text-slate-900'
                          }`}
                        >
                          {row.attendancePct}%
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-slate-900">
                          {row.cgpa.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                          ₹{row.feeDue.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 pl-3">
                          <StatusLabel status={row.riskLevel} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
