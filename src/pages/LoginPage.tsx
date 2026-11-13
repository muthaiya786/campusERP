import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  GraduationCap,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface DemoAccount {
  email: string;
  username: string;
  fullName: string;
  roles: string[];
  departmentId: string;
  departmentCode: string;
  departmentName: string;
}

interface DemoDepartment {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('hod.cse@vanguardtech.edu.in');
  const [password, setPassword] = useState('Vanguard@2026');
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [departments, setDepartments] = useState<DemoDepartment[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>('ALL_FILTER');
  const [institutionName, setInstitutionName] = useState('Vanguard Institute of Technology');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{
      institutionName: string;
      departments?: DemoDepartment[];
      accounts: DemoAccount[];
    }>('/auth/demo-accounts')
      .then((res) => {
        setDemoAccounts(res.accounts);
        if (res.departments) setDepartments(res.departments);
        setInstitutionName(res.institutionName);
      })
      .catch(() => {
        // Fallback if server is still warming
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickPortal = async (acct: DemoAccount) => {
    setIdentifier(acct.email);
    setPassword('Vanguard@2026');
    setError(null);
    setSubmitting(true);
    try {
      await login(acct.email, 'Vanguard@2026');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const roleSummary = (roles: string[]) => {
    if (roles.includes('COLLEGE_ADMIN') || roles.includes('PRINCIPAL')) {
      return 'Institution setup, multi-department expansion, RBAC matrix & audit';
    }
    if (roles.includes('HOD')) {
      return 'Department BI oversight, staff attendance/leave approvals & result publish';
    }
    if (roles.includes('FACULTY')) {
      return 'Assigned classes, attendance marking, internal marks & leave balance';
    }
    if (roles.includes('NON_TEACHING_STAFF')) {
      return 'Laboratory equipment registry, maintenance tickets & leave requests';
    }
    return 'Self-service attendance, timetable, assignments, published marks & fees';
  };

  const filterTabs = [
    { id: 'ALL_FILTER', label: 'All Logins' },
    { id: 'ADMIN_GROUP', label: 'Institution Admin' },
    ...departments.map((d) => ({ id: d.id, label: `${d.code} Dept` })),
  ];

  const visibleAccounts = demoAccounts.filter((acct) => {
    if (deptFilter === 'ALL_FILTER') return true;
    if (deptFilter === 'ADMIN_GROUP') return acct.departmentCode === 'ALL';
    return acct.departmentId === deptFilter && acct.departmentCode !== 'ALL';
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Institutional Overview Column */}
      <div className="lg:w-[44%] bg-slate-900 text-white p-8 lg:p-12 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-700 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-semibold tracking-tight block">
                {institutionName}
              </span>
              <span className="text-xs text-slate-400">
                College ERP · Multi-Department Edition
              </span>
            </div>
          </div>

          <div className="mt-12 max-w-md">
            <h1 className="text-3xl font-semibold tracking-tight text-white leading-tight">
              Department-Scoped Academic, Staff &amp; BI Governance
            </h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Sign in with your department credentials to access isolated department student rosters,
              year-wise BI reports, staff attendance registers, and leave approval workflows.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div className="border border-slate-800 bg-slate-800/40 rounded-lg p-4">
              <Building2 className="w-4 h-4 text-blue-400 mb-2" />
              <div className="text-sm font-medium text-white">Department-Wise Access</div>
              <div className="text-xs text-slate-400 mt-1">
                CSE, ECE, and newly created departments enforce strict data boundaries per login.
              </div>
            </div>
            <div className="border border-slate-800 bg-slate-800/40 rounded-lg p-4">
              <UserCheck className="w-4 h-4 text-blue-400 mb-2" />
              <div className="text-sm font-medium text-white">Staff Attendance &amp; Leave</div>
              <div className="text-xs text-slate-400 mt-1">
                Daily staff register, live available CL/ML/OD leave days, and HOD approval deduction.
              </div>
            </div>
            <div className="border border-slate-800 bg-slate-800/40 rounded-lg p-4">
              <Users className="w-4 h-4 text-blue-400 mb-2" />
              <div className="text-sm font-medium text-white">Year-Wise &amp; Dept BI</div>
              <div className="text-xs text-slate-400 mt-1">
                Separate 1st–4th Year cohorts and department-wise analytics with CSV export.
              </div>
            </div>
            <div className="border border-slate-800 bg-slate-800/40 rounded-lg p-4">
              <ShieldCheck className="w-4 h-4 text-blue-400 mb-2" />
              <div className="text-sm font-medium text-white">Role-Scoped Portals</div>
              <div className="text-xs text-slate-400 mt-1">
                Distinct menus and permissions for Student, Faculty, Lab Staff, HOD &amp; Admin.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>Active Departments: {departments.map((d) => d.code).join(' · ') || 'CSE · ECE'}</span>
          <span>Academic Year 2026–27</span>
        </div>
      </div>

      {/* Right Sign-In & Department Login Explorer Column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-2xl space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Department &amp; Role Sign In</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your department email or ID (e.g. hod.cse@vanguardtech.edu.in or hod.ece@vanguardtech.edu.in).
            </p>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-3.5 py-2.5">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Institutional Email or ID
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="hod.cse@vanguardtech.edu.in"
                    className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium py-2.5 px-4 transition-colors cursor-pointer"
              >
                <span>{submitting ? 'Authenticating...' : 'Sign In to Department Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Department-Wise Quick Login Explorer */}
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Department-Wise Login Directory
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a department filter and click any user to inspect their department-scoped data.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500 shrink-0">
                Password: Vanguard@2026
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg mb-4 w-fit">
              {filterTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDeptFilter(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                    deptFilter === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {visibleAccounts.map((acct) => (
                <button
                  key={acct.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleQuickPortal(acct)}
                  className="w-full text-left py-3 px-2 rounded-md hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 group cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-slate-900 group-hover:text-blue-700">
                        {acct.fullName}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-semibold text-blue-700">
                        {acct.departmentCode === 'ALL' ? 'INSTITUTION ADMIN' : `${acct.departmentCode} · ${acct.roles[0]}`}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{acct.email}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {roleSummary(acct.roles)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-blue-700 whitespace-nowrap shrink-0 inline-flex items-center gap-1">
                    Enter
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
