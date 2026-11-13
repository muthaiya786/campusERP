import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { getInitials } from '../ui/DataUi';
import { useAuth } from '../../context/AuthContext';
import type { ModuleCode, RoleCode } from '../../types/erp';

export interface NavItem {
  id: string;
  label: string;
  module: ModuleCode;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

type PersonaType = 'ADMIN' | 'HOD' | 'FACULTY' | 'NON_TEACHING' | 'STUDENT';

function resolvePersona(roles: RoleCode[]): PersonaType {
  if (roles.includes('SUPER_ADMIN') || roles.includes('COLLEGE_ADMIN') || roles.includes('PRINCIPAL')) {
    return 'ADMIN';
  }
  if (roles.includes('HOD')) return 'HOD';
  if (roles.includes('NON_TEACHING_STAFF') && !roles.includes('FACULTY')) return 'NON_TEACHING';
  if (roles.includes('FACULTY') || roles.includes('CLASS_ADVISOR')) return 'FACULTY';
  return 'STUDENT';
}

const MENUS_BY_PERSONA: Record<PersonaType, NavItem[]> = {
  STUDENT: [
    { id: 'stu_dashboard', label: 'My Dashboard', module: 'dashboard', icon: LayoutDashboard, group: 'Student Home' },
    { id: 'stu_attendance', label: 'My Attendance', module: 'attendance', icon: ClipboardCheck, group: 'Academics' },
    { id: 'stu_timetable', label: 'Class Timetable', module: 'timetable', icon: CalendarDays, group: 'Academics' },
    { id: 'stu_assignments', label: 'Assignments & Notes', module: 'assignments', icon: BookMarked, group: 'Academics' },
    { id: 'stu_results', label: 'Exam Results & CGPA', module: 'assessments', icon: Award, group: 'Academics' },
    { id: 'stu_documents', label: 'My Documents (Aadhar & IDs)', module: 'documents', icon: FileText, group: 'Documents & Certificates' },
    { id: 'stu_certificates', label: 'My Certificates', module: 'documents', icon: FileCheck2, group: 'Documents & Certificates' },
    { id: 'stu_fees', label: 'Fees & Receipts', module: 'fees', icon: CreditCard, group: 'Services' },
    { id: 'stu_requests', label: 'Leave, OD & Bonafide', module: 'requests', icon: ClipboardList, group: 'Services' },
    { id: 'stu_career', label: 'Career, Events & Projects', module: 'operations', icon: Briefcase, group: 'Services' },
  ],
  FACULTY: [
    { id: 'fac_dashboard', label: 'Faculty Dashboard', module: 'dashboard', icon: LayoutDashboard, group: 'Teaching Desk' },
    { id: 'fac_timetable', label: 'My Teaching Schedule', module: 'timetable', icon: CalendarDays, group: 'Teaching Desk' },
    { id: 'fac_subjects', label: 'Subjects & Syllabus', module: 'academics', icon: BookOpen, group: 'Teaching Desk' },
    { id: 'fac_attendance', label: 'Mark Class Attendance', module: 'attendance', icon: ClipboardCheck, group: 'Classroom' },
    { id: 'fac_assignments', label: 'Assignments & Grading', module: 'assignments', icon: BookMarked, group: 'Classroom' },
    { id: 'fac_marks', label: 'Internal Marks Entry', module: 'assessments', icon: Award, group: 'Classroom' },
    { id: 'fac_students', label: 'Student Lists & Mentoring', module: 'students', icon: Users, group: 'Mentoring & Leave' },
    { id: 'fac_documents', label: 'Documents (Student & Staff)', module: 'documents', icon: FileText, group: 'Documents & Certificates' },
    { id: 'fac_certificates', label: 'Certificates Vault', module: 'documents', icon: FileCheck2, group: 'Documents & Certificates' },
    { id: 'fac_staff_attendance', label: 'Staff Attendance & Leave', module: 'requests', icon: CalendarCheck2, group: 'Mentoring & Leave' },
    { id: 'fac_requests', label: 'Student Leave & Approvals', module: 'requests', icon: ClipboardList, group: 'Mentoring & Leave' },
    { id: 'fac_operations', label: 'Research, Projects & Events', module: 'operations', icon: FolderKanban, group: 'Mentoring & Leave' },
  ],
  NON_TEACHING: [
    { id: 'lab_dashboard', label: 'Lab Operations Home', module: 'dashboard', icon: LayoutDashboard, group: 'Lab Desk' },
    { id: 'lab_assets', label: 'Laboratories & Assets', module: 'operations', icon: FlaskConical, group: 'Lab Desk' },
    { id: 'lab_timetable', label: 'Lab Schedule', module: 'timetable', icon: CalendarDays, group: 'Lab Desk' },
    { id: 'lab_students', label: 'Student Lookup', module: 'students', icon: Users, group: 'Administration' },
    { id: 'lab_documents', label: 'Documents (Student & Staff)', module: 'documents', icon: FileText, group: 'Documents & Certificates' },
    { id: 'lab_certificates', label: 'Certificates Vault', module: 'documents', icon: FileCheck2, group: 'Documents & Certificates' },
    { id: 'lab_staff_attendance', label: 'My Attendance & Leave', module: 'requests', icon: CalendarCheck2, group: 'Administration' },
    { id: 'lab_requests', label: 'Service Requests', module: 'requests', icon: ClipboardList, group: 'Administration' },
  ],
  HOD: [
    { id: 'hod_dashboard', label: 'Department Dashboard', module: 'dashboard', icon: LayoutDashboard, group: 'Department Command' },
    { id: 'hod_bi', label: 'Department BI Reports', module: 'bi_reports', icon: BarChart3, group: 'Department Command' },
    { id: 'hod_requests', label: 'Approval Centre', module: 'requests', icon: ClipboardList, group: 'Department Command' },
    { id: 'hod_students', label: 'Students Directory', module: 'students', icon: Users, group: 'Academic Oversight' },
    { id: 'hod_staff', label: 'Faculty & Workload', module: 'staff', icon: UserCheck, group: 'Academic Oversight' },
    { id: 'hod_staff_attendance', label: 'Staff Attendance & Leave', module: 'staff', icon: CalendarCheck2, group: 'Academic Oversight' },
    { id: 'hod_documents', label: 'Documents (Aadhar & Passport)', module: 'documents', icon: FileText, group: 'Documents & Certificates' },
    { id: 'hod_certificates', label: 'Certificates Verification', module: 'documents', icon: FileCheck2, group: 'Documents & Certificates' },
    { id: 'hod_timetable', label: 'Curriculum & Timetable', module: 'timetable', icon: CalendarDays, group: 'Academic Oversight' },
    { id: 'hod_attendance', label: 'Attendance Shortage', module: 'attendance', icon: ClipboardCheck, group: 'Academic Oversight' },
    { id: 'hod_marks', label: 'Verify & Publish Results', module: 'assessments', icon: Award, group: 'Academic Oversight' },
    { id: 'hod_operations', label: 'Placement, IQAC & Labs', module: 'operations', icon: FolderKanban, group: 'Operations' },
    { id: 'hod_audit', label: 'Dept Policy & Audit', module: 'audit', icon: History, group: 'Operations' },
  ],
  ADMIN: [
    { id: 'adm_dashboard', label: 'Institution Dashboard', module: 'dashboard', icon: LayoutDashboard, group: 'Institution' },
    { id: 'adm_departments', label: 'Departments & Expansion', module: 'settings', icon: Building2, group: 'Institution' },
    { id: 'adm_bi', label: 'Executive BI Analytics', module: 'bi_reports', icon: BarChart3, group: 'Institution' },
    { id: 'adm_rbac', label: 'Users, Roles & RBAC', module: 'rbac', icon: Shield, group: 'Governance' },
    { id: 'adm_settings', label: 'Academic Policies', module: 'settings', icon: Settings, group: 'Governance' },
    { id: 'adm_audit', label: 'System Audit Trail', module: 'audit', icon: History, group: 'Governance' },
    { id: 'adm_people', label: 'Dept Students & Staff', module: 'students', icon: Users, group: 'Department Inspection' },
    { id: 'adm_staff_attendance', label: 'Staff Attendance & Leave', module: 'staff', icon: CalendarCheck2, group: 'Department Inspection' },
    { id: 'adm_documents', label: 'Documents (Aadhar & Passport)', module: 'documents', icon: FileText, group: 'Documents & Certificates' },
    { id: 'adm_certificates', label: 'Certificates Vault', module: 'documents', icon: FileCheck2, group: 'Documents & Certificates' },
    { id: 'adm_requests', label: 'Approvals & Fees', module: 'requests', icon: ClipboardList, group: 'Department Inspection' },
  ],
};

const PERSONA_LABELS: Record<PersonaType, string> = {
  STUDENT: 'Student Self-Service Portal',
  FACULTY: 'Faculty & Teaching Portal',
  NON_TEACHING: 'Lab & Technical Staff Portal',
  HOD: 'Department HOD Portal',
  ADMIN: 'College Admin & Principal Portal',
};

const QUICK_SWITCH_ACCOUNTS = [
  { label: 'College Admin — Dr. Subramanian', email: 'admin@vanguardtech.edu.in', roleTag: 'All Depts' },
  { label: 'CSE HOD — Dr. Meenakshi', email: 'hod.cse@vanguardtech.edu.in', roleTag: 'CSE' },
  { label: 'CSE Faculty — Prof. Karthik', email: 'karthik.r@vanguardtech.edu.in', roleTag: 'CSE' },
  { label: 'CSE Lab Staff — Mr. Senthil', email: 'senthil.lab@vanguardtech.edu.in', roleTag: 'CSE' },
  { label: 'CSE Student — Aaravindhan', email: 'aarav.24cse101@vanguardtech.edu.in', roleTag: 'CSE' },
  { label: 'ECE HOD — Dr. Aravind', email: 'hod.ece@vanguardtech.edu.in', roleTag: 'ECE' },
  { label: 'ECE Faculty — Prof. Priya', email: 'priya.ece@vanguardtech.edu.in', roleTag: 'ECE' },
  { label: 'ECE Student — Divya Bharathi', email: 'divya.24ece101@vanguardtech.edu.in', roleTag: 'ECE' },
];

export function AppShell({
  activeTab,
  onSelectTab,
  children,
}: {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  children: React.ReactNode;
}) {
  const {
    user,
    institution,
    departments,
    academicYears,
    selectedDepartmentId,
    setSelectedDepartmentId,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    can,
    login,
    logout,
  } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const persona = useMemo(() => resolvePersona(user?.roles || ['STUDENT']), [user?.roles]);
  const isInstitutionWide = persona === 'ADMIN';

  const visibleNav = useMemo(() => {
    return MENUS_BY_PERSONA[persona].filter((item) => can(item.module, 'view'));
  }, [persona, can]);

  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const item of visibleNav) {
      if (!seen.includes(item.group)) seen.push(item.group);
    }
    return seen;
  }, [visibleNav]);

  const activeNav = visibleNav.find((n) => n.id === activeTab) || visibleNav[0];
  const currentDept = departments.find((d) => d.id === selectedDepartmentId) || departments[0];

  const handleRoleSwitch = async (email: string) => {
    setProfileOpen(false);
    await login(email, 'Vanguard@2026');
    onSelectTab('dashboard');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800 shrink-0">
        <div className="w-8 h-8 rounded-md bg-blue-700 flex items-center justify-center shrink-0">
          <GraduationCap className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white font-display truncate">
            {institution?.shortCode || 'VIT-ERP'}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {PERSONA_LABELS[persona]}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {groups.map((group) => {
          const items = visibleNav.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="px-3 mb-1.5 text-[11px] font-medium text-slate-400">{group}</div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.id);
                        setMobileOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-blue-700 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs space-y-1">
        <div className="text-slate-300 font-medium truncate">{currentDept?.code} — {currentDept?.name}</div>
        <div className="text-slate-500 truncate">
          Portal: <span className="text-slate-300">{persona}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 no-print">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full shadow-xl">{sidebarContent}</div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="flex-1 bg-slate-900/50"
          />
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="font-semibold text-slate-900 truncate">
                {PERSONA_LABELS[persona]}
              </span>
              <span aria-hidden="true">/</span>
              <span className="text-slate-600 truncate">{activeNav?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isInstitutionWide && (
              <div className="hidden sm:flex items-center gap-2">
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  aria-label="Select department"
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onSelectTab('adm_departments')}
                  className="px-2.5 py-1.5 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-700 cursor-pointer whitespace-nowrap"
                >
                  + Add Dept
                </button>
              </div>
            )}

            <select
              value={selectedAcademicYearId}
              onChange={(e) => setSelectedAcademicYearId(e.target.value)}
              aria-label="Academic year"
              className="hidden md:block rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs tabular-nums text-slate-700"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  AY {ay.label}
                </option>
              ))}
            </select>

            {/* Profile & Instant Role Switcher Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="inline-flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                  {getInitials(user?.fullName || 'User')}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-medium text-slate-900 leading-tight">
                    {user?.fullName}
                  </div>
                  <div className="text-[11px] font-medium text-blue-700 leading-tight">
                    {user?.roles[0]?.replace(/_/g, ' ')} · {currentDept?.code}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-40">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-900">{user?.fullName}</div>
                    <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                    <div className="text-[11px] font-medium text-blue-700 mt-0.5">
                      Roles: {user?.roles.join(', ')}
                    </div>
                  </div>

                  <div className="px-4 py-2 border-b border-slate-100">
                    <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                      Switch Department &amp; Role Portal
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {QUICK_SWITCH_ACCOUNTS.map((acct) => (
                        <button
                          key={acct.email}
                          type="button"
                          onClick={() => handleRoleSwitch(acct.email)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                            user?.email === acct.email
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{acct.label}</span>
                          <span className="text-[11px] font-medium text-slate-500 shrink-0">{acct.roleTag}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="px-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-5 sm:p-7 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
