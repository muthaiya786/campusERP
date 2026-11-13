/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AcademicsTimetablePage } from './pages/AcademicsTimetablePage';
import { AssessmentsAssignmentsPage } from './pages/AssessmentsAssignmentsPage';
import { AttendancePage } from './pages/AttendancePage';
import { BIReportsPage } from './pages/BIReportsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { DocumentsCertificatesPage } from './pages/DocumentsCertificatesPage';
import { GovernancePage } from './pages/GovernancePage';
import { LoginPage } from './pages/LoginPage';
import { OperationsPage } from './pages/OperationsPage';
import { PeopleDirectoryPage } from './pages/PeopleDirectoryPage';
import { RequestsFeesPage } from './pages/RequestsFeesPage';
import { StaffAttendanceLeavePage } from './pages/StaffAttendanceLeavePage';

function ErpWorkspace() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-600">Loading Vanguard College ERP...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (activeTab) {
      // Dashboards
      case 'dashboard':
      case 'stu_dashboard':
      case 'fac_dashboard':
      case 'lab_dashboard':
      case 'hod_dashboard':
      case 'adm_dashboard':
        return <DashboardPage onNavigate={setActiveTab} />;

      // Multi-Department Management (Admin/Principal)
      case 'departments':
      case 'adm_departments':
        return <DepartmentsPage onNavigate={setActiveTab} />;

      // BI Analytics & Reports
      case 'bi_reports':
      case 'hod_bi':
      case 'adm_bi':
        return <BIReportsPage onNavigate={setActiveTab} />;

      // Attendance
      case 'attendance':
      case 'stu_attendance':
      case 'fac_attendance':
      case 'hod_attendance':
        return <AttendancePage />;

      // Timetable
      case 'timetable':
      case 'stu_timetable':
      case 'fac_timetable':
      case 'lab_timetable':
      case 'hod_timetable':
        return <AcademicsTimetablePage initialTab="timetable" />;

      // Curriculum & Syllabus
      case 'academics':
      case 'fac_subjects':
        return <AcademicsTimetablePage initialTab="curriculum" />;

      // Assessments & Marks
      case 'assessments':
      case 'stu_results':
      case 'fac_marks':
      case 'hod_marks':
        return <AssessmentsAssignmentsPage initialTab="assessments" />;

      // Assignments & Materials
      case 'assignments':
      case 'stu_assignments':
      case 'fac_assignments':
        return <AssessmentsAssignmentsPage initialTab="assignments" />;

      // Students & Staff Directory
      case 'students':
      case 'fac_students':
      case 'lab_students':
      case 'hod_students':
      case 'adm_people':
        return <PeopleDirectoryPage initialTab="students" />;

      case 'hod_staff':
        return <PeopleDirectoryPage initialTab="staff" />;

      // Staff Attendance, Leave Balance & Approvals
      case 'staff_attendance':
      case 'fac_staff_attendance':
      case 'lab_staff_attendance':
      case 'hod_staff_attendance':
      case 'adm_staff_attendance':
        return <StaffAttendanceLeavePage />;

      // Documents & Certificates Vault
      case 'documents':
      case 'stu_documents':
      case 'fac_documents':
      case 'lab_documents':
      case 'hod_documents':
      case 'adm_documents':
        return <DocumentsCertificatesPage initialSection="DOCUMENT" />;

      case 'certificates':
      case 'stu_certificates':
      case 'fac_certificates':
      case 'lab_certificates':
      case 'hod_certificates':
      case 'adm_certificates':
        return <DocumentsCertificatesPage initialSection="CERTIFICATE" />;

      // Requests & Approvals
      case 'requests':
      case 'stu_requests':
      case 'fac_requests':
      case 'lab_requests':
      case 'hod_requests':
      case 'adm_requests':
        return <RequestsFeesPage initialTab="requests" />;

      // Fees & Receipts
      case 'fees':
      case 'stu_fees':
        return <RequestsFeesPage initialTab="fees" />;

      // Department Operations (Projects, Placements, Events, IQAC, Labs)
      case 'operations':
      case 'stu_career':
      case 'fac_operations':
      case 'lab_assets':
      case 'hod_operations':
        return <OperationsPage />;

      // Governance: RBAC, Settings, Audit
      case 'governance':
      case 'adm_rbac':
        return <GovernancePage initialTab="rbac" />;

      case 'settings':
      case 'adm_settings':
        return <GovernancePage initialTab="settings" />;

      case 'hod_audit':
      case 'adm_audit':
        return <GovernancePage initialTab="audit" />;

      default:
        return <DashboardPage onNavigate={setActiveTab} />;
    }
  };

  return (
    <AppShell activeTab={activeTab} onSelectTab={setActiveTab}>
      {renderPage()}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ErpWorkspace />
    </AuthProvider>
  );
}
