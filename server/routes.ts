import express from 'express';
import type {
  AttendanceStatus,
  DocumentCategory,
  LeaveCategory,
  ModuleCode,
  PermissionAction,
  RoleCode,
  SafeUser,
  StaffAttendanceStatus,
  VaultDocument,
  VaultSection,
} from '../src/types/erp.js';
import {
  type AuthenticatedRequest,
  hashPassword,
  hasPermission,
  isInstitutionWideUser,
  requireAuth,
  requirePermission,
  signToken,
  toSafeUser,
  verifyPassword,
} from './auth.js';
import { addAuditLog, getDb, resetDbToSeed, saveDb } from './db.js';

export const apiRouter = express.Router();

function resolveDepartmentScope(user: SafeUser, requestedDeptId?: string): string {
  if (isInstitutionWideUser(user) && requestedDeptId) {
    return requestedDeptId;
  }
  return user.departmentId;
}

function getYearOfStudy(semester: number): number {
  return Math.min(4, Math.max(1, Math.ceil((semester || 1) / 2)));
}

function getYearLabel(year: number): string {
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  return '4th Year';
}

function calculateInclusiveDays(fromDate?: string, toDate?: string): number {
  if (!fromDate) return 1;
  const start = new Date(`${fromDate}T00:00:00Z`).getTime();
  const end = new Date(`${(toDate || fromDate)}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function formatLeaveBalance(bal?: {
  staffId: string;
  departmentId: string;
  academicYearId: string;
  clTotal: number;
  clUsed: number;
  mlTotal: number;
  mlUsed: number;
  odTotal: number;
  odUsed: number;
}) {
  const b = bal || {
    staffId: '',
    departmentId: '',
    academicYearId: 'ay-2026-27',
    clTotal: 12,
    clUsed: 0,
    mlTotal: 10,
    mlUsed: 0,
    odTotal: 15,
    odUsed: 0,
  };
  const clAvailable = Math.max(0, b.clTotal - b.clUsed);
  const mlAvailable = Math.max(0, b.mlTotal - b.mlUsed);
  const odAvailable = Math.max(0, b.odTotal - b.odUsed);
  return {
    ...b,
    clAvailable,
    mlAvailable,
    odAvailable,
    totalAvailable: clAvailable + mlAvailable + odAvailable,
    totalAllocated: b.clTotal + b.mlTotal + b.odTotal,
    totalUsed: b.clUsed + b.mlUsed + b.odUsed,
  };
}

function calculateStudentAttendance(studentId: string, departmentId: string, subjectId?: string) {
  const db = getDb();
  const sessions = db.attendanceSessions.filter(
    (s) => s.departmentId === departmentId && (!subjectId || s.subjectId === subjectId)
  );
  let total = 0;
  let attended = 0;
  let onDuty = 0;
  for (const session of sessions) {
    const rec = session.records.find((r) => r.studentId === studentId);
    if (!rec) continue;
    total += 1;
    if (rec.status === 'PRESENT') attended += 1;
    if (rec.status === 'ON_DUTY') {
      attended += 1;
      onDuty += 1;
    }
  }
  const percentage = total > 0 ? Math.round((attended / total) * 1000) / 10 : 100;
  return { total, attended, onDuty, absent: total - attended, percentage };
}

// Health & Public Context
apiRouter.get('/health', (_req, res) => {
  const db = getDb();
  res.json({
    status: 'ok',
    institution: db.institution.name,
    activeDepartments: db.departments.filter((d) => d.active).length,
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/auth/demo-accounts', (_req, res) => {
  const db = getDb();
  const accounts = db.users
    .filter((u) => u.status === 'ACTIVE')
    .map((u) => {
      const dept = db.departments.find((d) => d.id === u.departmentId);
      const isInst = u.roles.includes('COLLEGE_ADMIN') || u.roles.includes('PRINCIPAL') || u.roles.includes('SUPER_ADMIN');
      return {
        email: u.email,
        username: u.username,
        fullName: u.fullName,
        roles: u.roles,
        departmentId: u.departmentId,
        departmentCode: isInst ? 'ALL' : dept?.code || 'DEPT',
        departmentName: isInst ? 'Institution Administration (All Depts)' : dept?.name || 'Department',
      };
    });
  res.json({
    institutionName: db.institution.name,
    defaultPasswordHint: 'Vanguard@2026',
    departments: db.departments.map((d) => ({ id: d.id, code: d.code, name: d.name, active: d.active })),
    accounts,
  });
});

apiRouter.post('/auth/login', (req, res) => {
  const { identifier, password } = req.body as { identifier?: string; password?: string };
  if (!identifier || !password) {
    res.status(400).json({ error: 'Email/username and password are required.' });
    return;
  }
  const db = getDb();
  const normalized = identifier.trim().toLowerCase();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === normalized || u.username.toLowerCase() === normalized
  );
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }
  if (user.status !== 'ACTIVE') {
    res.status(403).json({ error: `Account is ${user.status.toLowerCase()}. Contact administrator.` });
    return;
  }
  user.lastLoginAt = new Date().toISOString();
  saveDb();
  const safeUser = toSafeUser(user, db.rbacMatrix);
  const token = signToken({
    userId: user.id,
    roles: user.roles,
    departmentId: user.departmentId,
  });

  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: user.departmentId,
    action: 'USER_LOGIN',
    module: 'dashboard',
    entityType: 'UserAccount',
    entityId: user.id,
    summary: `${user.fullName} signed in (${user.roles.join(', ')}).`,
  });

  res.json({
    token,
    user: safeUser,
    institution: db.institution,
    departments: db.departments,
    academicYears: db.academicYears,
  });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  res.json({
    user: req.authUser,
    institution: db.institution,
    departments: db.departments,
    academicYears: db.academicYears,
  });
});

// Role-Scoped Dashboard
apiRouter.get('/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  const dept = db.departments.find((d) => d.id === deptId) || db.departments[0];
  const threshold = db.institution.attendanceThresholdPct;

  const deptStudents = db.students.filter((s) => s.departmentId === deptId && s.status === 'ACTIVE');
  const deptStaff = db.staff.filter((s) => s.departmentId === deptId && s.status === 'ACTIVE');
  const deptSubjects = db.subjects.filter((s) => s.departmentId === deptId && s.active);
  const deptRequests = db.requests.filter((r) => r.departmentId === deptId);
  const announcements = db.announcements.filter(
    (a) => a.departmentId === 'ALL' || a.departmentId === deptId
  );

  // Student Portal Dashboard
  if (user.roles.includes('STUDENT') && user.studentId) {
    const student = db.students.find((s) => s.id === user.studentId);
    if (!student) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }
    const section = db.sections.find((sec) => sec.id === student.sectionId);
    const programme = db.programmes.find((p) => p.id === student.programmeId);
    const overallAtt = calculateStudentAttendance(student.id, student.departmentId);

    const subjectAttendance = deptSubjects
      .filter((sub) => sub.semester === student.semester && sub.sectionId === student.sectionId)
      .map((sub) => ({
        subjectId: sub.id,
        code: sub.code,
        title: sub.title,
        ...calculateStudentAttendance(student.id, student.departmentId, sub.id),
      }));

    const todaySlots = db.timetableSlots
      .filter((t) => t.sectionId === student.sectionId && t.published)
      .slice(0, 6)
      .map((t) => ({
        ...t,
        subjectTitle: db.subjects.find((s) => s.id === t.subjectId)?.title || t.subjectId,
        subjectCode: db.subjects.find((s) => s.id === t.subjectId)?.code || '',
        facultyName: db.staff.find((st) => st.id === t.facultyStaffId)?.fullName || '',
      }));

    const pendingAssignments = db.assignments
      .filter((a) => a.sectionId === student.sectionId)
      .map((a) => {
        const subm = a.submissions.find((s) => s.studentId === student.id);
        return {
          id: a.id,
          title: a.title,
          subjectCode: db.subjects.find((s) => s.id === a.subjectId)?.code || '',
          dueDate: a.dueDate,
          maxMarks: a.maxMarks,
          submissionStatus: subm ? subm.status : 'PENDING',
          marks: subm?.marks,
        };
      });

    const publishedAssessments = db.assessments
      .filter((a) => a.sectionId === student.sectionId && a.status === 'PUBLISHED')
      .map((a) => {
        const mark = a.marks.find((m) => m.studentId === student.id);
        return {
          id: a.id,
          title: a.title,
          componentType: a.componentType,
          maxMarks: a.maxMarks,
          scoredMarks: mark?.scoredMarks ?? null,
          passMarks: a.passMarks,
          examDate: a.examDate,
        };
      });

    const feeLedger = db.feeLedgers.filter((f) => f.studentId === student.id);
    const feeBalance = feeLedger.reduce(
      (sum, f) => sum + (f.totalAmount - f.concessionAmount - f.paidAmount),
      0
    );

    const myRequests = deptRequests.filter(
      (r) => r.studentId === student.id || r.requesterUserId === user.id
    );

    res.json({
      portalMode: 'STUDENT',
      department: dept,
      student,
      programmeName: programme?.name || '',
      sectionName: section?.name || '',
      attendanceThresholdPct: threshold,
      overallAttendance: overallAtt,
      subjectAttendance,
      todaySlots,
      pendingAssignments,
      publishedAssessments,
      feeBalance,
      myRequests,
      announcements,
      upcomingEvents: db.events.filter((e) => e.departmentId === deptId && e.status === 'APPROVED'),
      openPlacements: db.jobOpenings.filter((j) => j.departmentId === deptId && j.status === 'OPEN'),
    });
    return;
  }

  // Faculty / HOD / Admin Calculations
  const studentAttendanceList = deptStudents.map((st) => {
    const att = calculateStudentAttendance(st.id, deptId);
    return {
      studentId: st.id,
      registerNumber: st.registerNumber,
      fullName: st.fullName,
      sectionId: st.sectionId,
      semester: st.semester,
      cgpa: st.cgpa,
      ...att,
    };
  });

  const shortageStudents = studentAttendanceList.filter((s) => s.total > 0 && s.percentage < threshold);
  const avgAttendancePct =
    studentAttendanceList.length > 0
      ? Math.round(
          (studentAttendanceList.reduce((acc, s) => acc + s.percentage, 0) /
            studentAttendanceList.length) *
            10
        ) / 10
      : 0;

  const syllabusMetrics = deptSubjects.map((sub) => {
    const totalTopics = sub.syllabusUnits.reduce((sum, u) => sum + u.totalTopics, 0);
    const completedTopics = sub.syllabusUnits.reduce((sum, u) => sum + u.completedTopics, 0);
    const pct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    return {
      subjectId: sub.id,
      code: sub.code,
      title: sub.title,
      facultyStaffId: sub.facultyStaffId,
      facultyName: db.staff.find((s) => s.id === sub.facultyStaffId)?.fullName || '',
      completedTopics,
      totalTopics,
      completionPct: pct,
    };
  });

  const avgSyllabusPct =
    syllabusMetrics.length > 0
      ? Math.round(syllabusMetrics.reduce((a, b) => a + b.completionPct, 0) / syllabusMetrics.length)
      : 0;

  const pendingApprovalsCount =
    deptRequests.filter((r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').length +
    db.attendanceCorrections.filter((c) => c.departmentId === deptId && c.status === 'SUBMITTED').length;

  const mySubjects = user.staffId
    ? deptSubjects.filter((s) => s.facultyStaffId === user.staffId)
    : deptSubjects;

  const myTimetable = user.staffId
    ? db.timetableSlots.filter((t) => t.facultyStaffId === user.staffId)
    : db.timetableSlots.filter((t) => t.departmentId === deptId);

  const pendingAssessments = db.assessments.filter(
    (a) => a.departmentId === deptId && a.status !== 'PUBLISHED'
  );

  const iqacAvg =
    db.accreditationEvidence.length > 0
      ? Math.round(
          db.accreditationEvidence
            .filter((e) => e.departmentId === deptId)
            .reduce((sum, e) => sum + e.completionPct, 0) /
            Math.max(1, db.accreditationEvidence.filter((e) => e.departmentId === deptId).length)
        )
      : 0;

  const portalMode = isInstitutionWideUser(user)
    ? 'ADMIN'
    : user.roles.includes('HOD')
    ? 'HOD'
    : 'FACULTY';

  const myBalanceRecord = user.staffId
    ? db.staffLeaveBalances.find((b) => b.staffId === user.staffId)
    : undefined;
  const myLeaveBalance = user.staffId ? formatLeaveBalance(myBalanceRecord) : null;

  const latestStaffAttDate =
    db.staffAttendance
      .filter((a) => a.departmentId === deptId)
      .map((a) => a.date)
      .sort()
      .pop() || '2026-11-12';
  const latestStaffAttRecords = db.staffAttendance.filter(
    (a) => a.departmentId === deptId && a.date === latestStaffAttDate
  );
  const staffPresentToday = latestStaffAttRecords.filter(
    (a) => a.status === 'PRESENT' || a.status === 'ON_DUTY'
  ).length;
  const pendingStaffLeaveCount = deptRequests.filter(
    (r) => r.type === 'STAFF_LEAVE' && (r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW')
  ).length;

  res.json({
    portalMode,
    department: dept,
    attendanceThresholdPct: threshold,
    kpis: {
      totalStudents: deptStudents.length,
      totalStaff: deptStaff.length,
      teachingStaff: deptStaff.filter((s) => s.category === 'TEACHING').length,
      activeSubjects: deptSubjects.length,
      avgAttendancePct,
      shortageCount: shortageStudents.length,
      avgSyllabusPct,
      pendingApprovalsCount,
      pendingMarksCount: pendingAssessments.length,
      iqacReadinessPct: iqacAvg,
      activeDepartmentsCount: db.departments.filter((d) => d.active).length,
      totalUsersCount: db.users.length,
    },
    myLeaveBalance,
    staffSummary: {
      latestDate: latestStaffAttDate,
      presentToday: staffPresentToday,
      totalStaff: deptStaff.length,
      pendingStaffLeaveCount,
    },
    shortageStudents,
    syllabusMetrics,
    mySubjects,
    myTimetable: myTimetable.map((t) => ({
      ...t,
      subjectCode: db.subjects.find((s) => s.id === t.subjectId)?.code || '',
      subjectTitle: db.subjects.find((s) => s.id === t.subjectId)?.title || '',
      sectionName: db.sections.find((sec) => sec.id === t.sectionId)?.name || '',
    })),
    pendingRequests: deptRequests.filter((r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW'),
    pendingCorrections: db.attendanceCorrections.filter((c) => c.departmentId === deptId && c.status === 'SUBMITTED'),
    pendingAssessments,
    announcements,
    recentAuditLogs: db.auditLogs.slice(0, 6),
    calendarItems: db.academicCalendar,
  });
});

// BI Analytics Endpoint (Real aggregations by Department & Year of Study)
apiRouter.get('/bi/reports', requireAuth, requirePermission('bi_reports', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const requestedDeptId = req.query.departmentId as string | undefined;
  const isAllDepts = isInstitutionWideUser(user) && requestedDeptId === 'ALL';
  const deptId = isAllDepts ? 'ALL' : resolveDepartmentScope(user, requestedDeptId);
  const yearFilter = req.query.yearOfStudy ? Number(req.query.yearOfStudy) : undefined;
  const semesterFilter = req.query.semester ? Number(req.query.semester) : undefined;
  const sectionFilter = (req.query.sectionId as string) || undefined;

  const matchesDept = (id: string) => isAllDepts || id === deptId;

  // Baseline students in department scope (before year/semester/section slice) for Year-wise breakdown
  const deptAllStudents = db.students.filter((s) => matchesDept(s.departmentId));

  const students = deptAllStudents.filter(
    (s) =>
      (!yearFilter || getYearOfStudy(s.semester) === yearFilter) &&
      (!semesterFilter || s.semester === semesterFilter) &&
      (!sectionFilter || s.sectionId === sectionFilter)
  );
  const studentIds = new Set(students.map((s) => s.id));
  const threshold = db.institution.attendanceThresholdPct;

  // 1. Attendance Trend by Session Date
  const sessions = db.attendanceSessions.filter(
    (s) => matchesDept(s.departmentId) && (!sectionFilter || s.sectionId === sectionFilter)
  );
  const dateMap = new Map<string, { present: number; od: number; absent: number; total: number }>();
  for (const sess of sessions) {
    const entry = dateMap.get(sess.date) || { present: 0, od: 0, absent: 0, total: 0 };
    for (const r of sess.records) {
      if (!studentIds.has(r.studentId)) continue;
      entry.total += 1;
      if (r.status === 'PRESENT') entry.present += 1;
      else if (r.status === 'ON_DUTY') entry.od += 1;
      else entry.absent += 1;
    }
    if (entry.total > 0) {
      dateMap.set(sess.date, entry);
    }
  }
  const attendanceTrend = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, val]) => ({
      date,
      label: date.slice(5),
      attendancePct: val.total > 0 ? Math.round(((val.present + val.od) / val.total) * 1000) / 10 : 100,
      present: val.present,
      onDuty: val.od,
      absent: val.absent,
      total: val.total,
    }));

  // 2. Year-Wise Student Report Breakdown (Years 1–4)
  const yearWiseBreakdown = [1, 2, 3, 4].map((year) => {
    const yrStudents = deptAllStudents.filter((st) => getYearOfStudy(st.semester) === year);
    const yrAtts = yrStudents.map((st) => calculateStudentAttendance(st.id, st.departmentId));
    const avgAtt =
      yrAtts.length > 0
        ? Math.round((yrAtts.reduce((sum, a) => sum + a.percentage, 0) / yrAtts.length) * 10) / 10
        : 0;
    const avgCgpa =
      yrStudents.length > 0
        ? Math.round((yrStudents.reduce((sum, st) => sum + st.cgpa, 0) / yrStudents.length) * 100) / 100
        : 0;
    const shortageCount = yrAtts.filter((a) => a.total > 0 && a.percentage < threshold).length;
    return {
      yearOfStudy: year,
      yearLabel: getYearLabel(year),
      studentCount: yrStudents.length,
      avgAttendancePct: avgAtt,
      avgCgpa,
      shortageCount,
    };
  });

  // 3. Department-Wise Comparison Table
  const scopedDepts = isInstitutionWideUser(user)
    ? db.departments
    : db.departments.filter((d) => d.id === user.departmentId);

  const departmentComparison = scopedDepts.map((d) => {
    const dStudents = db.students.filter((st) => st.departmentId === d.id && st.status === 'ACTIVE');
    const dStaff = db.staff.filter((st) => st.departmentId === d.id && st.status === 'ACTIVE');
    const dAtts = dStudents.map((st) => calculateStudentAttendance(st.id, d.id));
    const avgAtt =
      dAtts.length > 0
        ? Math.round((dAtts.reduce((sum, a) => sum + a.percentage, 0) / dAtts.length) * 10) / 10
        : 0;
    const avgCgpa =
      dStudents.length > 0
        ? Math.round((dStudents.reduce((sum, st) => sum + st.cgpa, 0) / dStudents.length) * 100) / 100
        : 0;
    const dLatestDate =
      db.staffAttendance.filter((a) => a.departmentId === d.id).map((a) => a.date).sort().pop() || '2026-11-12';
    const dStaffAtt = db.staffAttendance.filter((a) => a.departmentId === d.id && a.date === dLatestDate);
    const staffPresentPct =
      dStaffAtt.length > 0
        ? Math.round(
            (dStaffAtt.filter((a) => a.status === 'PRESENT' || a.status === 'ON_DUTY').length / dStaffAtt.length) * 1000
          ) / 10
        : 100;
    return {
      departmentId: d.id,
      code: d.code,
      name: d.name,
      studentCount: dStudents.length,
      staffCount: dStaff.length,
      avgAttendancePct: avgAtt,
      avgCgpa,
      staffAttendancePct: staffPresentPct,
    };
  });

  // 4. Section Strength & Average Attendance
  const sectionBreakdown = db.sections
    .filter(
      (sec) =>
        matchesDept(sec.departmentId) &&
        (!yearFilter || getYearOfStudy(sec.semester) === yearFilter) &&
        (!semesterFilter || sec.semester === semesterFilter)
    )
    .map((sec) => {
      const secStudents = students.filter((st) => st.sectionId === sec.id);
      const avgAtt =
        secStudents.length > 0
          ? Math.round(
              (secStudents.reduce(
                (sum, st) => sum + calculateStudentAttendance(st.id, st.departmentId).percentage,
                0
              ) /
                secStudents.length) *
                10
            ) / 10
          : 0;
      const avgCgpa =
        secStudents.length > 0
          ? Math.round((secStudents.reduce((sum, st) => sum + st.cgpa, 0) / secStudents.length) * 100) / 100
          : 0;
      return {
        sectionId: sec.id,
        sectionName: sec.name,
        departmentCode: db.departments.find((d) => d.id === sec.departmentId)?.code || '',
        semester: sec.semester,
        yearOfStudy: getYearOfStudy(sec.semester),
        studentCount: secStudents.length,
        avgAttendancePct: avgAtt,
        avgCgpa,
      };
    });

  // 5. Assessment Subject Performance & Grade Bands
  const filteredAssessments = db.assessments.filter(
    (a) => matchesDept(a.departmentId) && (!sectionFilter || a.sectionId === sectionFilter)
  );
  const subjectPerformance = filteredAssessments.map((asm) => {
    const subj = db.subjects.find((s) => s.id === asm.subjectId);
    const relevantMarks = asm.marks.filter((m) => studentIds.has(m.studentId));
    const marksToUse = relevantMarks.length > 0 || !yearFilter ? (relevantMarks.length > 0 ? relevantMarks : asm.marks) : [];
    const total = marksToUse.length;
    const passed = marksToUse.filter((m) => m.scoredMarks >= asm.passMarks).length;
    const avgScorePct =
      total > 0
        ? Math.round((marksToUse.reduce((sum, m) => sum + (m.scoredMarks / asm.maxMarks) * 100, 0) / total) * 10) / 10
        : 0;
    const highScore = total > 0 ? Math.max(...marksToUse.map((m) => m.scoredMarks)) : 0;
    return {
      assessmentId: asm.id,
      title: asm.title,
      subjectCode: subj?.code || '',
      componentType: asm.componentType,
      status: asm.status,
      passRatePct: total > 0 ? Math.round((passed / total) * 1000) / 10 : 0,
      avgScorePct,
      highScore,
      maxMarks: asm.maxMarks,
    };
  });

  // Grade distribution across CGPA bands
  const gradeDistribution = [
    { band: 'Distinction (>= 8.5 CGPA)', count: students.filter((s) => s.cgpa >= 8.5).length, color: '#16A34A' },
    { band: 'First Class (7.5 – 8.49)', count: students.filter((s) => s.cgpa >= 7.5 && s.cgpa < 8.5).length, color: '#2563EB' },
    { band: 'Second Class (6.5 – 7.49)', count: students.filter((s) => s.cgpa >= 6.5 && s.cgpa < 7.5).length, color: '#D97706' },
    { band: 'Needs Mentoring (< 6.5)', count: students.filter((s) => s.cgpa < 6.5).length, color: '#DC2626' },
  ];

  // 6. Faculty Workload & Syllabus Velocity
  const deptStaff = db.staff.filter((s) => matchesDept(s.departmentId) && s.category === 'TEACHING');
  const facultyWorkload = deptStaff.map((st) => {
    const assignedSlots = db.timetableSlots.filter((t) => t.facultyStaffId === st.id);
    const theoryHours = assignedSlots.filter((t) => t.slotType === 'THEORY' || t.slotType === 'TUTORIAL').length;
    const labHours = assignedSlots.filter((t) => t.slotType === 'PRACTICAL').length * 2;
    const subjects = db.subjects.filter((sub) => sub.facultyStaffId === st.id);
    const totalTopics = subjects.reduce((s, sub) => s + sub.syllabusUnits.reduce((u, un) => u + un.totalTopics, 0), 0);
    const completedTopics = subjects.reduce((s, sub) => s + sub.syllabusUnits.reduce((u, un) => u + un.completedTopics, 0), 0);
    return {
      staffId: st.id,
      fullName: st.fullName,
      designation: st.designation,
      theoryHours,
      labHours,
      totalAssignedHours: theoryHours + labHours,
      weeklyMaxHours: st.weeklyMaxHours,
      syllabusCompletionPct: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
      publications: st.publicationCount,
    };
  });

  // 7. Fee Collection Analytics
  const feeLedgers = db.feeLedgers.filter(
    (f) => matchesDept(f.departmentId) && studentIds.has(f.studentId)
  );
  const feeSummary = {
    totalBilled: feeLedgers.reduce((s, f) => s + f.totalAmount, 0),
    concessions: feeLedgers.reduce((s, f) => s + f.concessionAmount, 0),
    collected: feeLedgers.reduce((s, f) => s + f.paidAmount, 0),
    pending: feeLedgers.reduce((s, f) => s + (f.totalAmount - f.concessionAmount - f.paidAmount), 0),
  };

  // 8. Placement & IQAC Readiness
  const jobs = db.jobOpenings.filter((j) => matchesDept(j.departmentId));
  const totalApplicants = new Set(jobs.flatMap((j) => j.applicantStudentIds)).size;
  const totalSelected = new Set(jobs.flatMap((j) => j.selectedStudentIds)).size;
  const iqacItems = db.accreditationEvidence.filter((e) => matchesDept(e.departmentId));

  // 9. Student Shortage & Risk Table
  const riskMatrix = students.map((st) => {
    const att = calculateStudentAttendance(st.id, st.departmentId);
    const fee = db.feeLedgers.find((f) => f.studentId === st.id);
    const feeDue = fee ? fee.totalAmount - fee.concessionAmount - fee.paidAmount : 0;
    const deptCode = db.departments.find((d) => d.id === st.departmentId)?.code || '';
    const yr = getYearOfStudy(st.semester);
    return {
      studentId: st.id,
      registerNumber: st.registerNumber,
      fullName: st.fullName,
      departmentCode: deptCode,
      yearOfStudy: yr,
      yearLabel: getYearLabel(yr),
      semester: st.semester,
      sectionName: db.sections.find((sec) => sec.id === st.sectionId)?.name || '',
      attendancePct: att.percentage,
      cgpa: st.cgpa,
      feeDue,
      riskLevel:
        att.percentage < threshold || st.cgpa < 7.0
          ? 'HIGH_RISK'
          : att.percentage < threshold + 5
          ? 'WATCH'
          : 'NOMINAL',
    };
  });

  res.json({
    filters: {
      departmentId: deptId,
      yearOfStudy: yearFilter ?? null,
      semester: semesterFilter ?? null,
      sectionId: sectionFilter ?? null,
    },
    thresholdPct: threshold,
    summary: {
      totalStudents: students.length,
      avgCgpa:
        students.length > 0
          ? Math.round((students.reduce((s, st) => s + st.cgpa, 0) / students.length) * 100) / 100
          : 0,
      avgAttendancePct:
        riskMatrix.length > 0
          ? Math.round((riskMatrix.reduce((s, r) => s + r.attendancePct, 0) / riskMatrix.length) * 10) / 10
          : 0,
      shortageCount: riskMatrix.filter((r) => r.attendancePct < threshold).length,
      placementEligibleApplicants: totalApplicants,
      placedStudents: totalSelected,
      iqacAvgCompletionPct:
        iqacItems.length > 0
          ? Math.round(iqacItems.reduce((s, i) => s + i.completionPct, 0) / iqacItems.length)
          : 0,
    },
    yearWiseBreakdown,
    departmentComparison,
    attendanceTrend,
    sectionBreakdown,
    subjectPerformance,
    gradeDistribution,
    facultyWorkload,
    feeSummary,
    iqacItems,
    riskMatrix,
  });
});

// Students API (with strict student & department self-scoping!)
apiRouter.get('/students', requireAuth, requirePermission('students', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  const yearFilter = req.query.yearOfStudy ? Number(req.query.yearOfStudy) : undefined;

  let list = db.students.filter((s) => s.departmentId === deptId);
  if (yearFilter) {
    list = list.filter((s) => getYearOfStudy(s.semester) === yearFilter);
  }
  if (user.roles.includes('STUDENT') && user.studentId) {
    list = list.filter((s) => s.id === user.studentId);
  }

  const enriched = list.map((s) => {
    const att = calculateStudentAttendance(s.id, deptId);
    const fee = db.feeLedgers.find((f) => f.studentId === s.id);
    const yearOfStudy = getYearOfStudy(s.semester);
    return {
      ...s,
      yearOfStudy,
      yearLabel: getYearLabel(yearOfStudy),
      departmentCode: db.departments.find((d) => d.id === s.departmentId)?.code || '',
      programmeName: db.programmes.find((p) => p.id === s.programmeId)?.name || '',
      batchLabel: db.batches.find((b) => b.id === s.batchId)?.label || '',
      sectionName: db.sections.find((sec) => sec.id === s.sectionId)?.name || '',
      mentorName: db.staff.find((st) => st.id === s.mentorStaffId)?.fullName || '',
      attendancePct: att.percentage,
      feeDue: fee ? fee.totalAmount - fee.concessionAmount - fee.paidAmount : 0,
    };
  });

  res.json({ students: enriched });
});

apiRouter.get('/students/:id', requireAuth, requirePermission('students', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }
  if (user.roles.includes('STUDENT') && user.studentId !== student.id) {
    res.status(403).json({ error: 'Scope violation: students can only access their own profile.' });
    return;
  }
  if (!isInstitutionWideUser(user) && student.departmentId !== user.departmentId) {
    res.status(403).json({ error: 'Cross-department access denied.' });
    return;
  }
  res.json({ student });
});

apiRouter.post('/students', requireAuth, requirePermission('students', 'create'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const body = req.body as Partial<typeof db.students[number]>;
  const deptId = resolveDepartmentScope(user, body.departmentId);

  if (!body.registerNumber || !body.fullName || !body.email) {
    res.status(400).json({ error: 'Register number, full name, and email are required.' });
    return;
  }
  if (db.students.some((s) => s.registerNumber.toLowerCase() === body.registerNumber!.toLowerCase())) {
    res.status(409).json({ error: 'Register number already exists.' });
    return;
  }

  const sectionId = body.sectionId || db.sections.find((s) => s.departmentId === deptId)?.id || 'sec-5a';
  const sec = db.sections.find((s) => s.id === sectionId);
  const newStudent: typeof db.students[number] = {
    id: `stu-${Date.now()}`,
    institutionId: db.institution.id,
    departmentId: deptId,
    registerNumber: body.registerNumber.trim().toUpperCase(),
    fullName: body.fullName.trim(),
    email: body.email.trim(),
    phone: body.phone || '+91 98000 00000',
    dob: body.dob || '2006-01-01',
    gender: body.gender || 'Male',
    programmeId: body.programmeId || db.programmes.find((p) => p.departmentId === deptId)?.id || 'prog-be-cse',
    batchId: sec?.batchId || 'batch-2024',
    semester: sec?.semester || Number(body.semester) || 5,
    sectionId,
    mentorStaffId: body.mentorStaffId || sec?.advisorStaffId || 'staff-02',
    admissionDate: new Date().toISOString().slice(0, 10),
    admissionCategory: body.admissionCategory || 'Regular',
    status: 'ACTIVE',
    guardianName: body.guardianName || 'Guardian On File',
    guardianPhone: body.guardianPhone || '+91 94430 00000',
    address: body.address || 'Coimbatore',
    cgpa: Number(body.cgpa) || 7.8,
    documentsVerified: false,
    documents: [],
  };

  db.students.unshift(newStudent);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: deptId,
    action: 'STUDENT_CREATED',
    module: 'students',
    entityType: 'Student',
    entityId: newStudent.id,
    summary: `Admitted student ${newStudent.registerNumber} (${newStudent.fullName}).`,
  });
  res.status(201).json({ student: newStudent });
});

// Staff Management
apiRouter.get('/staff', requireAuth, requirePermission('staff', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  const list = db.staff
    .filter((s) => s.departmentId === deptId)
    .map((s) => {
      const assignedSubjects = db.subjects.filter((sub) => sub.facultyStaffId === s.id);
      const assignedSlots = db.timetableSlots.filter((t) => t.facultyStaffId === s.id);
      return {
        ...s,
        assignedSubjects: assignedSubjects.map((sub) => ({ id: sub.id, code: sub.code, title: sub.title })),
        currentWeeklyHours: assignedSlots.reduce((sum, slot) => sum + (slot.slotType === 'PRACTICAL' ? 2 : 1), 0),
      };
    });
  res.json({ staff: list });
});

apiRouter.post('/staff', requireAuth, requirePermission('staff', 'create'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const body = req.body as Partial<typeof db.staff[number]>;
  const deptId = resolveDepartmentScope(user, body.departmentId);
  if (!body.staffCode || !body.fullName || !body.email) {
    res.status(400).json({ error: 'Staff code, name, and email are required.' });
    return;
  }
  const newStaff: typeof db.staff[number] = {
    id: `staff-${Date.now()}`,
    institutionId: db.institution.id,
    departmentId: deptId,
    staffCode: body.staffCode.trim().toUpperCase(),
    fullName: body.fullName.trim(),
    email: body.email.trim(),
    phone: body.phone || '+91 98422 99000',
    category: body.category || 'TEACHING',
    designation: body.designation || 'Assistant Professor',
    qualification: body.qualification || 'M.E.',
    specialization: body.specialization || 'Computer Systems',
    joiningDate: new Date().toISOString().slice(0, 10),
    status: 'ACTIVE',
    weeklyMaxHours: Number(body.weeklyMaxHours) || 18,
    assignedRoles: body.assignedRoles?.length ? body.assignedRoles : ['FACULTY'],
    fdpCount: 0,
    publicationCount: 0,
  };
  db.staff.push(newStaff);
  db.staffLeaveBalances.push({
    staffId: newStaff.id,
    departmentId: deptId,
    academicYearId: db.institution.activeAcademicYearId,
    clTotal: 12,
    clUsed: 0,
    mlTotal: 10,
    mlUsed: 0,
    odTotal: 15,
    odUsed: 0,
  });
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: deptId,
    action: 'STAFF_CREATED',
    module: 'staff',
    entityType: 'Staff',
    entityId: newStaff.id,
    summary: `Onboarded ${newStaff.fullName} (${newStaff.staffCode}) as ${newStaff.designation}.`,
  });
  res.status(201).json({ staff: newStaff });
});

// Academic Structure & Multi-Department Configuration
apiRouter.get('/academics/structure', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  res.json({
    institution: db.institution,
    departments: db.departments,
    activeDepartmentId: deptId,
    programmes: db.programmes.filter((p) => p.departmentId === deptId),
    regulations: db.regulations,
    academicYears: db.academicYears,
    batches: db.batches.filter((b) => b.departmentId === deptId),
    sections: db.sections.filter((s) => s.departmentId === deptId),
    subjects: db.subjects.filter((s) => s.departmentId === deptId).map((sub) => ({
      ...sub,
      facultyName: db.staff.find((st) => st.id === sub.facultyStaffId)?.fullName || '',
      sectionName: db.sections.find((sec) => sec.id === sub.sectionId)?.name || '',
    })),
    academicCalendar: db.academicCalendar,
  });
});

apiRouter.get('/departments', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const list = db.departments.map((d) => {
    const hod = d.hodStaffId ? db.staff.find((s) => s.id === d.hodStaffId) : undefined;
    return {
      ...d,
      hodName: hod?.fullName || 'Unassigned',
      programmeCount: db.programmes.filter((p) => p.departmentId === d.id).length,
      studentCount: db.students.filter((s) => s.departmentId === d.id && s.status === 'ACTIVE').length,
      staffCount: db.staff.filter((s) => s.departmentId === d.id && s.status === 'ACTIVE').length,
      subjectCount: db.subjects.filter((s) => s.departmentId === d.id && s.active).length,
      programmes: db.programmes.filter((p) => p.departmentId === d.id),
    };
  });
  res.json({ departments: list, regulations: db.regulations });
});

apiRouter.post('/departments', requireAuth, requirePermission('settings', 'create'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const {
    code,
    name,
    email,
    vision,
    mission,
    programmeName,
    programmeCode,
    programmeCategory,
    totalSemesters,
    intakeCapacity,
    regulationId,
    hodName,
    hodEmail,
  } = req.body as {
    code?: string;
    name?: string;
    email?: string;
    vision?: string;
    mission?: string;
    programmeName?: string;
    programmeCode?: string;
    programmeCategory?: 'UG' | 'PG' | 'PhD' | 'Diploma';
    totalSemesters?: number;
    intakeCapacity?: number;
    regulationId?: string;
    hodName?: string;
    hodEmail?: string;
  };
  if (!code || !name) {
    res.status(400).json({ error: 'Department code and name are required.' });
    return;
  }
  if (db.departments.some((d) => d.code.toLowerCase() === code.trim().toLowerCase())) {
    res.status(409).json({ error: `Department code ${code} already exists.` });
    return;
  }

  const cleanCode = code.trim().toUpperCase();
  const deptId = `dept-${cleanCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
  let hodStaffId: string | undefined;

  if (hodName && hodName.trim()) {
    hodStaffId = `staff-${cleanCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
    const resolvedHodEmail = (hodEmail || `hod.${cleanCode.toLowerCase()}@vanguardtech.edu.in`).trim();
    db.staff.push({
      id: hodStaffId,
      institutionId: db.institution.id,
      departmentId: deptId,
      staffCode: `VIT-${cleanCode}-001`,
      fullName: hodName.trim(),
      email: resolvedHodEmail,
      phone: '+91 98422 20001',
      category: 'TEACHING',
      designation: 'Professor & HOD',
      qualification: 'Ph.D.',
      specialization: name.trim(),
      joiningDate: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
      weeklyMaxHours: 12,
      assignedRoles: ['HOD', 'FACULTY'],
      fdpCount: 0,
      publicationCount: 0,
    });
    db.staffLeaveBalances.push({
      staffId: hodStaffId,
      departmentId: deptId,
      academicYearId: db.institution.activeAcademicYearId,
      clTotal: 12,
      clUsed: 0,
      mlTotal: 10,
      mlUsed: 0,
      odTotal: 15,
      odUsed: 0,
    });
    if (!db.users.some((u) => u.email.toLowerCase() === resolvedHodEmail.toLowerCase())) {
      db.users.push({
        id: `usr-${cleanCode.toLowerCase()}-hod-${Date.now().toString().slice(-4)}`,
        email: resolvedHodEmail,
        username: `VIT-${cleanCode}-001`,
        passwordHash: hashPassword('Vanguard@2026', 'vanguard-erp-salt'),
        fullName: hodName.trim(),
        roles: ['HOD', 'FACULTY'],
        departmentId: deptId,
        staffId: hodStaffId,
        status: 'ACTIVE',
      });
    }
  }

  const newDept = {
    id: deptId,
    institutionId: db.institution.id,
    code: cleanCode,
    name: name.trim(),
    hodStaffId,
    email: (email || hodEmail || `hod.${cleanCode.toLowerCase()}@vanguardtech.edu.in`).trim(),
    vision: vision || `Advancing excellence in ${name.trim()}.`,
    mission: mission || 'Delivering outcome-based engineering education.',
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.departments.push(newDept);

  if (programmeName && programmeName.trim()) {
    const sems = Number(totalSemesters) || 8;
    const newProg = {
      id: `prog-${Date.now()}`,
      departmentId: newDept.id,
      code: (programmeCode || `BE-${newDept.code}`).toUpperCase(),
      name: programmeName.trim(),
      category: programmeCategory || ('UG' as const),
      durationYears: Math.max(1, Math.round(sems / 2)),
      totalSemesters: sems,
      intakeCapacity: Number(intakeCapacity) || 60,
      regulationId: regulationId || 'reg-2025',
      active: true,
    };
    db.programmes.push(newProg);
    const newBatch = {
      id: `batch-${Date.now()}`,
      programmeId: newProg.id,
      departmentId: newDept.id,
      label: '2026–2030',
      regulationId: newProg.regulationId,
      currentSemester: 1,
      active: true,
    };
    db.batches.push(newBatch);
    db.sections.push({
      id: `sec-${Date.now()}`,
      batchId: newBatch.id,
      departmentId: newDept.id,
      name: 'I Sem - Sec A',
      semester: 1,
      advisorStaffId: hodStaffId,
      roomCode: `${newDept.code}-101`,
      strength: 0,
    });
  }

  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: newDept.id,
    action: 'DEPARTMENT_CREATED',
    module: 'settings',
    entityType: 'Department',
    entityId: newDept.id,
    summary: `Configured new department ${newDept.code} — ${newDept.name} via Admin configuration.`,
  });
  res.status(201).json({ department: newDept, departments: db.departments });
});

apiRouter.patch('/departments/:id/status', requireAuth, requirePermission('settings', 'edit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const dept = db.departments.find((d) => d.id === req.params.id);
  if (!dept) {
    res.status(404).json({ error: 'Department not found.' });
    return;
  }
  dept.active = Boolean(req.body.active);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: dept.id,
    action: dept.active ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED',
    module: 'settings',
    entityType: 'Department',
    entityId: dept.id,
    summary: `${dept.active ? 'Activated' : 'Deactivated'} department ${dept.code} — ${dept.name}.`,
  });
  res.json({ department: dept });
});

apiRouter.post('/subjects', requireAuth, requirePermission('academics', 'create'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const body = req.body as Partial<typeof db.subjects[number]>;
  const deptId = resolveDepartmentScope(user, body.departmentId);
  if (!body.code || !body.title) {
    res.status(400).json({ error: 'Subject code and title are required.' });
    return;
  }
  const newSubject: typeof db.subjects[number] = {
    id: `sub-${Date.now()}`,
    departmentId: deptId,
    programmeId: body.programmeId || db.programmes.find((p) => p.departmentId === deptId)?.id || 'prog-be-cse',
    regulationId: body.regulationId || 'reg-2023',
    code: body.code.trim().toUpperCase(),
    title: body.title.trim(),
    category: body.category || 'CORE',
    semester: Number(body.semester) || 5,
    credits: Number(body.credits) || 3,
    weeklyHours: Number(body.weeklyHours) || 4,
    theoryHours: Number(body.theoryHours) || 4,
    practicalHours: Number(body.practicalHours) || 0,
    facultyStaffId: body.facultyStaffId || 'staff-02',
    sectionId: body.sectionId || db.sections.find((s) => s.departmentId === deptId)?.id || 'sec-5a',
    courseOutcomes: body.courseOutcomes || ['CO1: Core theoretical mastery', 'CO2: Applied engineering implementation'],
    syllabusUnits: [
      { unitNumber: 1, title: 'Unit I: Foundations & Architecture', totalTopics: 8, completedTopics: 0, targetDate: '2026-09-01' },
      { unitNumber: 2, title: 'Unit II: Core Algorithms & Protocols', totalTopics: 8, completedTopics: 0, targetDate: '2026-10-15' },
    ],
    active: true,
  };
  db.subjects.push(newSubject);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: deptId,
    action: 'SUBJECT_CREATED',
    module: 'academics',
    entityType: 'Subject',
    entityId: newSubject.id,
    summary: `Mapped subject ${newSubject.code} (${newSubject.title}) to Sem ${newSubject.semester}.`,
  });
  res.status(201).json({ subject: newSubject });
});

apiRouter.patch('/subjects/:id/syllabus', requireAuth, requirePermission('academics', 'edit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const subject = db.subjects.find((s) => s.id === req.params.id);
  if (!subject) {
    res.status(404).json({ error: 'Subject not found.' });
    return;
  }
  const { unitNumber, completedTopics } = req.body as { unitNumber: number; completedTopics: number };
  const unit = subject.syllabusUnits.find((u) => u.unitNumber === Number(unitNumber));
  if (!unit) {
    res.status(404).json({ error: 'Syllabus unit not found.' });
    return;
  }
  unit.completedTopics = Math.max(0, Math.min(unit.totalTopics, Number(completedTopics)));
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: subject.departmentId,
    action: 'SYLLABUS_PROGRESS_UPDATED',
    module: 'academics',
    entityType: 'Subject',
    entityId: subject.id,
    summary: `Updated ${subject.code} Unit ${unit.unitNumber} progress to ${unit.completedTopics}/${unit.totalTopics} topics.`,
  });
  res.json({ subject });
});

// Timetable with Clash Detection & Publish
apiRouter.get('/timetable', requireAuth, requirePermission('timetable', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  let slots = db.timetableSlots.filter((t) => t.departmentId === deptId);
  if (user.roles.includes('STUDENT')) {
    slots = slots.filter((t) => t.published);
  }
  const enriched = slots.map((t) => ({
    ...t,
    subjectCode: db.subjects.find((s) => s.id === t.subjectId)?.code || '',
    subjectTitle: db.subjects.find((s) => s.id === t.subjectId)?.title || '',
    facultyName: db.staff.find((st) => st.id === t.facultyStaffId)?.fullName || '',
    sectionName: db.sections.find((sec) => sec.id === t.sectionId)?.name || '',
  }));
  res.json({ slots: enriched });
});

apiRouter.post('/timetable', requireAuth, requirePermission('timetable', 'create'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const body = req.body as Partial<typeof db.timetableSlots[number]>;
  const deptId = resolveDepartmentScope(user, body.departmentId);

  if (!body.sectionId || !body.subjectId || !body.facultyStaffId || !body.day || !body.period || !body.roomCode) {
    res.status(400).json({ error: 'Section, subject, faculty, day, period, and room are required.' });
    return;
  }

  // Server-side Clash Detection
  const sameTime = db.timetableSlots.filter(
    (s) => s.departmentId === deptId && s.day === body.day && s.period === Number(body.period)
  );
  const facultyClash = sameTime.find((s) => s.facultyStaffId === body.facultyStaffId);
  if (facultyClash) {
    const fac = db.staff.find((st) => st.id === body.facultyStaffId)?.fullName || 'Selected faculty';
    res.status(409).json({
      error: `Faculty clash detected: ${fac} is already scheduled on ${body.day} Period ${body.period} in ${facultyClash.roomCode}.`,
    });
    return;
  }
  const roomClash = sameTime.find((s) => s.roomCode.toLowerCase() === body.roomCode!.trim().toLowerCase());
  if (roomClash) {
    res.status(409).json({
      error: `Room clash detected: ${body.roomCode} is already occupied on ${body.day} Period ${body.period}.`,
    });
    return;
  }
  const sectionClash = sameTime.find((s) => s.sectionId === body.sectionId);
  if (sectionClash) {
    res.status(409).json({
      error: `Section clash detected: Selected section already has a class on ${body.day} Period ${body.period}.`,
    });
    return;
  }

  const periodTimes: Record<number, [string, string]> = {
    1: ['09:00', '09:55'],
    2: ['10:00', '10:55'],
    3: ['11:15', '12:10'],
    4: ['13:15', '14:10'],
    5: ['14:15', '15:10'],
  };
  const [startTime, endTime] = periodTimes[Number(body.period)] || ['15:15', '16:10'];

  const newSlot: typeof db.timetableSlots[number] = {
    id: `tt-${Date.now()}`,
    departmentId: deptId,
    academicYearId: db.institution.activeAcademicYearId,
    sectionId: body.sectionId,
    subjectId: body.subjectId,
    facultyStaffId: body.facultyStaffId,
    day: body.day,
    period: Number(body.period),
    startTime,
    endTime,
    roomCode: body.roomCode.trim().toUpperCase(),
    slotType: body.slotType || 'THEORY',
    published: false,
  };
  db.timetableSlots.push(newSlot);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: deptId,
    action: 'TIMETABLE_SLOT_ADDED',
    module: 'timetable',
    entityType: 'TimetableSlot',
    entityId: newSlot.id,
    summary: `Scheduled ${newSlot.day} P${newSlot.period} in ${newSlot.roomCode} (Draft).`,
  });
  res.status(201).json({ slot: newSlot });
});

apiRouter.post('/timetable/publish', requireAuth, requirePermission('timetable', 'publish'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.body.departmentId as string | undefined);
  let count = 0;
  for (const slot of db.timetableSlots) {
    if (slot.departmentId === deptId && !slot.published) {
      slot.published = true;
      count += 1;
    }
  }
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: deptId,
    action: 'TIMETABLE_PUBLISHED',
    module: 'timetable',
    entityType: 'Timetable',
    entityId: deptId,
    summary: `Published ${count} timetable slot(s) to student and faculty portals.`,
  });
  res.json({ publishedCount: count });
});

// Attendance Sessions, Marking & Corrections
apiRouter.get('/attendance', requireAuth, requirePermission('attendance', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);

  const sessions = db.attendanceSessions
    .filter((s) => s.departmentId === deptId)
    .map((s) => {
      const records =
        user.roles.includes('STUDENT') && user.studentId
          ? s.records.filter((r) => r.studentId === user.studentId)
          : s.records;
      return {
        ...s,
        subjectCode: db.subjects.find((sub) => sub.id === s.subjectId)?.code || '',
        subjectTitle: db.subjects.find((sub) => sub.id === s.subjectId)?.title || '',
        sectionName: db.sections.find((sec) => sec.id === s.sectionId)?.name || '',
        records,
      };
    });

  const targetStudents =
    user.roles.includes('STUDENT') && user.studentId
      ? db.students.filter((st) => st.id === user.studentId)
      : db.students.filter((st) => st.departmentId === deptId);

  const studentSummary = targetStudents.map((st) => ({
    studentId: st.id,
    registerNumber: st.registerNumber,
    fullName: st.fullName,
    sectionId: st.sectionId,
    sectionName: db.sections.find((sec) => sec.id === st.sectionId)?.name || '',
    ...calculateStudentAttendance(st.id, deptId),
  }));

  const corrections = db.attendanceCorrections
    .filter((c) => c.departmentId === deptId)
    .filter((c) => (!user.roles.includes('STUDENT') ? true : c.studentId === user.studentId))
    .map((c) => ({
      ...c,
      studentName: db.students.find((s) => s.id === c.studentId)?.fullName || '',
      registerNumber: db.students.find((s) => s.id === c.studentId)?.registerNumber || '',
      subjectCode: db.subjects.find((sub) => sub.id === c.subjectId)?.code || '',
    }));

  res.json({
    thresholdPct: db.institution.attendanceThresholdPct,
    sessions,
    studentSummary,
    corrections,
  });
});

apiRouter.post('/attendance/mark', requireAuth, requirePermission('attendance', 'create'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const { subjectId, sectionId, date, period, topicCovered, records } = req.body as {
    subjectId: string;
    sectionId: string;
    date: string;
    period: number;
    topicCovered: string;
    records: { studentId: string; status: AttendanceStatus }[];
  };
  if (!subjectId || !sectionId || !date || !records?.length) {
    res.status(400).json({ error: 'Subject, section, date, and attendance records are required.' });
    return;
  }
  const subject = db.subjects.find((s) => s.id === subjectId);
  const deptId = subject?.departmentId || user.departmentId;

  // Duplicate check per PRD rule
  const duplicate = db.attendanceSessions.find(
    (s) => s.subjectId === subjectId && s.sectionId === sectionId && s.date === date && s.period === Number(period)
  );
  if (duplicate) {
    res.status(409).json({
      error: `Attendance already submitted for ${subject?.code} on ${date} Period ${period}. Use Correction Request workflow to modify.`,
    });
    return;
  }

  const newSession = {
    id: `att-${Date.now()}`,
    departmentId: deptId,
    subjectId,
    sectionId,
    facultyStaffId: user.staffId || subject?.facultyStaffId || 'staff-02',
    date,
    period: Number(period) || 1,
    topicCovered: topicCovered || 'Scheduled Lecture Session',
    submittedAt: new Date().toISOString(),
    submittedBy: user.fullName,
    records,
  };
  db.attendanceSessions.unshift(newSession);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: deptId,
    action: 'ATTENDANCE_MARKED',
    module: 'attendance',
    entityType: 'AttendanceSession',
    entityId: newSession.id,
    summary: `Submitted attendance for ${subject?.code || subjectId} (${date}, P${newSession.period}) covering ${records.length} students.`,
  });
  res.status(201).json({ session: newSession });
});

apiRouter.post('/attendance/corrections', requireAuth, requirePermission('attendance', 'submit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const { sessionId, studentId, requestedStatus, reason } = req.body as {
    sessionId: string;
    studentId?: string;
    requestedStatus: AttendanceStatus;
    reason: string;
  };
  const session = db.attendanceSessions.find((s) => s.id === sessionId);
  if (!session) {
    res.status(404).json({ error: 'Attendance session not found.' });
    return;
  }
  const targetStudentId = user.roles.includes('STUDENT') ? user.studentId! : studentId!;
  const rec = session.records.find((r) => r.studentId === targetStudentId);
  if (!rec) {
    res.status(404).json({ error: 'Student record not found in this session.' });
    return;
  }
  const correction = {
    id: `ac-${Date.now()}`,
    departmentId: session.departmentId,
    sessionId,
    studentId: targetStudentId,
    subjectId: session.subjectId,
    date: session.date,
    currentStatus: rec.status,
    requestedStatus,
    reason: reason || 'Evidence provided for correction.',
    requestedByUserId: user.id,
    requestedByName: user.fullName,
    status: 'SUBMITTED' as const,
    createdAt: new Date().toISOString(),
  };
  db.attendanceCorrections.unshift(correction);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: session.departmentId,
    action: 'ATTENDANCE_CORRECTION_REQUESTED',
    module: 'attendance',
    entityType: 'AttendanceCorrectionRequest',
    entityId: correction.id,
    summary: `Requested ${rec.status} -> ${requestedStatus} correction for session ${session.date}.`,
  });
  res.status(201).json({ correction });
});

apiRouter.patch('/attendance/corrections/:id', requireAuth, requirePermission('attendance', 'approve'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const correction = db.attendanceCorrections.find((c) => c.id === req.params.id);
  if (!correction) {
    res.status(404).json({ error: 'Correction request not found.' });
    return;
  }
  const { decision, comment } = req.body as { decision: 'APPROVED' | 'REJECTED'; comment?: string };
  correction.status = decision;
  correction.reviewedByName = user.fullName;
  correction.reviewComment = comment || decision;

  if (decision === 'APPROVED') {
    const sess = db.attendanceSessions.find((s) => s.id === correction.sessionId);
    const rec = sess?.records.find((r) => r.studentId === correction.studentId);
    if (rec) rec.status = correction.requestedStatus;
  }
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: correction.departmentId,
    action: `ATTENDANCE_CORRECTION_${decision}`,
    module: 'attendance',
    entityType: 'AttendanceCorrectionRequest',
    entityId: correction.id,
    summary: `${decision} attendance correction (${correction.currentStatus} -> ${correction.requestedStatus}) on ${correction.date}.`,
  });
  res.json({ correction });
});

// Assignments & Learning Materials
apiRouter.get('/assignments', requireAuth, requirePermission('assignments', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  const assignments = db.assignments
    .filter((a) => a.departmentId === deptId)
    .map((a) => ({
      ...a,
      subjectCode: db.subjects.find((s) => s.id === a.subjectId)?.code || '',
      subjectTitle: db.subjects.find((s) => s.id === a.subjectId)?.title || '',
      sectionName: db.sections.find((sec) => sec.id === a.sectionId)?.name || '',
      facultyName: db.staff.find((st) => st.id === a.facultyStaffId)?.fullName || '',
      submissions:
        user.roles.includes('STUDENT') && user.studentId
          ? a.submissions.filter((sub) => sub.studentId === user.studentId)
          : a.submissions.map((sub) => ({
              ...sub,
              studentName: db.students.find((st) => st.id === sub.studentId)?.fullName || '',
              registerNumber: db.students.find((st) => st.id === sub.studentId)?.registerNumber || '',
            })),
    }));

  const materials = db.learningMaterials
    .filter((m) => m.departmentId === deptId)
    .map((m) => ({
      ...m,
      subjectCode: db.subjects.find((s) => s.id === m.subjectId)?.code || '',
    }));

  res.json({ assignments, materials });
});

apiRouter.post('/assignments', requireAuth, requirePermission('assignments', 'create'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const { subjectId, sectionId, title, instructions, maxMarks, dueDate } = req.body as {
    subjectId: string;
    sectionId: string;
    title: string;
    instructions: string;
    maxMarks: number;
    dueDate: string;
  };
  if (!subjectId || !title || !dueDate) {
    res.status(400).json({ error: 'Subject, title, and due date are required.' });
    return;
  }
  const subj = db.subjects.find((s) => s.id === subjectId);
  const newAsg = {
    id: `asg-${Date.now()}`,
    departmentId: subj?.departmentId || user.departmentId,
    subjectId,
    sectionId: sectionId || subj?.sectionId || 'sec-5a',
    facultyStaffId: user.staffId || subj?.facultyStaffId || 'staff-02',
    title: title.trim(),
    instructions: instructions || 'Upload PDF technical report.',
    maxMarks: Number(maxMarks) || 25,
    dueDate,
    createdAt: new Date().toISOString(),
    submissions: [],
  };
  db.assignments.unshift(newAsg);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: newAsg.departmentId,
    action: 'ASSIGNMENT_CREATED',
    module: 'assignments',
    entityType: 'Assignment',
    entityId: newAsg.id,
    summary: `Published assignment "${newAsg.title}" for ${subj?.code || subjectId}.`,
  });
  res.status(201).json({ assignment: newAsg });
});

apiRouter.post('/assignments/:id/submit', requireAuth, requirePermission('assignments', 'submit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const asg = db.assignments.find((a) => a.id === req.params.id);
  if (!asg) {
    res.status(404).json({ error: 'Assignment not found.' });
    return;
  }
  if (!user.studentId) {
    res.status(403).json({ error: 'Only students can submit assignment deliverables.' });
    return;
  }
  const { fileName, notes } = req.body as { fileName?: string; notes?: string };
  const existing = asg.submissions.find((s) => s.studentId === user.studentId);
  const isLate = new Date().toISOString().slice(0, 10) > asg.dueDate;
  if (existing) {
    existing.fileName = fileName || existing.fileName;
    existing.notes = notes || existing.notes;
    existing.submittedAt = new Date().toISOString();
    existing.status = isLate ? 'LATE' : 'SUBMITTED';
  } else {
    asg.submissions.push({
      id: `subm-${Date.now()}`,
      studentId: user.studentId,
      submittedAt: new Date().toISOString(),
      fileName: fileName || `${user.username}_submission.pdf`,
      notes: notes || 'Submitted via Student Portal.',
      status: isLate ? 'LATE' : 'SUBMITTED',
    });
  }
  saveDb();
  res.json({ assignment: asg });
});

apiRouter.post('/assignments/:id/grade', requireAuth, requirePermission('assignments', 'edit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const asg = db.assignments.find((a) => a.id === req.params.id);
  if (!asg) {
    res.status(404).json({ error: 'Assignment not found.' });
    return;
  }
  const { submissionId, marks, feedback } = req.body as { submissionId: string; marks: number; feedback?: string };
  const subm = asg.submissions.find((s) => s.id === submissionId);
  if (!subm) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }
  subm.marks = Math.max(0, Math.min(asg.maxMarks, Number(marks)));
  subm.feedback = feedback || 'Evaluated.';
  subm.status = 'GRADED';
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: asg.departmentId,
    action: 'ASSIGNMENT_GRADED',
    module: 'assignments',
    entityType: 'Assignment',
    entityId: asg.id,
    summary: `Graded submission ${submissionId} with ${subm.marks}/${asg.maxMarks} marks.`,
  });
  res.json({ submission: subm });
});

// Assessments & Controlled Result Publication
apiRouter.get('/assessments', requireAuth, requirePermission('assessments', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);

  let list = db.assessments.filter((a) => a.departmentId === deptId);
  // Critical PRD Rule: Students must NOT see unpublished marks!
  if (user.roles.includes('STUDENT')) {
    list = list.filter((a) => a.status === 'PUBLISHED');
  }

  const enriched = list.map((a) => ({
    ...a,
    subjectCode: db.subjects.find((s) => s.id === a.subjectId)?.code || '',
    subjectTitle: db.subjects.find((s) => s.id === a.subjectId)?.title || '',
    sectionName: db.sections.find((sec) => sec.id === a.sectionId)?.name || '',
    marks:
      user.roles.includes('STUDENT') && user.studentId
        ? a.marks.filter((m) => m.studentId === user.studentId)
        : a.marks.map((m) => ({
            ...m,
            studentName: db.students.find((st) => st.id === m.studentId)?.fullName || '',
            registerNumber: db.students.find((st) => st.id === m.studentId)?.registerNumber || '',
          })),
  }));

  res.json({ assessments: enriched, gradingScale: db.institution.gradingScale });
});

apiRouter.post('/assessments/:id/marks', requireAuth, requirePermission('assessments', 'edit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const asm = db.assessments.find((a) => a.id === req.params.id);
  if (!asm) {
    res.status(404).json({ error: 'Assessment not found.' });
    return;
  }
  if (asm.status === 'PUBLISHED') {
    res.status(409).json({ error: 'Published results cannot be edited directly. Use authorized revaluation workflow.' });
    return;
  }
  const { marks, submitForVerification } = req.body as {
    marks: { studentId: string; scoredMarks: number; remarks?: string }[];
    submitForVerification?: boolean;
  };
  for (const entry of marks) {
    if (entry.scoredMarks < 0 || entry.scoredMarks > asm.maxMarks) {
      res.status(400).json({ error: `Marks must be between 0 and ${asm.maxMarks}.` });
      return;
    }
  }
  asm.marks = marks;
  if (submitForVerification) {
    asm.status = 'SUBMITTED';
  }
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: asm.departmentId,
    action: submitForVerification ? 'MARKS_SUBMITTED_FOR_VERIFICATION' : 'MARKS_SAVED_DRAFT',
    module: 'assessments',
    entityType: 'Assessment',
    entityId: asm.id,
    summary: `${submitForVerification ? 'Submitted' : 'Saved draft'} marks for ${asm.title}.`,
  });
  res.json({ assessment: asm });
});

apiRouter.post('/assessments/:id/publish', requireAuth, requirePermission('assessments', 'publish'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const asm = db.assessments.find((a) => a.id === req.params.id);
  if (!asm) {
    res.status(404).json({ error: 'Assessment not found.' });
    return;
  }
  asm.status = 'PUBLISHED';
  asm.publishedAt = new Date().toISOString();
  asm.publishedBy = user.fullName;
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: asm.departmentId,
    action: 'RESULTS_PUBLISHED',
    module: 'assessments',
    entityType: 'Assessment',
    entityId: asm.id,
    summary: `Published ${asm.title} results to Student Portal (${asm.marks.length} student records).`,
  });
  res.json({ assessment: asm });
});

// Staff Attendance, Leave Balance & Leave Approval
apiRouter.get('/staff-attendance', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  if (user.roles.includes('STUDENT') && !user.staffId) {
    res.status(403).json({ error: 'Students cannot access staff attendance & leave registers.' });
    return;
  }
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  const canManageRegister =
    user.roles.includes('HOD') ||
    isInstitutionWideUser(user) ||
    hasPermission(user, 'staff', 'edit');

  const deptAttendanceDates = db.staffAttendance
    .filter((a) => a.departmentId === deptId)
    .map((a) => a.date)
    .sort();
  const defaultDate = deptAttendanceDates[deptAttendanceDates.length - 1] || '2026-11-12';
  const selectedDate = (req.query.date as string) || defaultDate;

  const deptStaff = db.staff.filter((s) => s.departmentId === deptId && s.status === 'ACTIVE');
  const visibleStaff = canManageRegister
    ? deptStaff
    : deptStaff.filter((s) => s.id === user.staffId);

  const staffRegister = visibleStaff.map((st) => {
    const dayRecord = db.staffAttendance.find(
      (a) => a.departmentId === deptId && a.staffId === st.id && a.date === selectedDate
    );
    const bal = formatLeaveBalance(db.staffLeaveBalances.find((b) => b.staffId === st.id));
    return {
      staffId: st.id,
      staffCode: st.staffCode,
      fullName: st.fullName,
      category: st.category,
      designation: st.designation,
      date: selectedDate,
      status: dayRecord?.status || 'PRESENT',
      checkInTime: dayRecord?.checkInTime || '08:55',
      remarks: dayRecord?.remarks || '',
      markedByName: dayRecord?.markedByName || 'Pending confirmation',
      isMarkedOnServer: Boolean(dayRecord),
      leaveBalance: bal,
    };
  });

  const myBalance = user.staffId
    ? formatLeaveBalance(db.staffLeaveBalances.find((b) => b.staffId === user.staffId))
    : null;

  const myAttendanceHistory = user.staffId
    ? db.staffAttendance
        .filter((a) => a.staffId === user.staffId)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const staffLeaveRequests = db.requests
    .filter((r) => r.departmentId === deptId && r.type === 'STAFF_LEAVE')
    .filter((r) => (canManageRegister ? true : r.requesterUserId === user.id || r.staffId === user.staffId))
    .map((r) => {
      const bal = r.staffId ? formatLeaveBalance(db.staffLeaveBalances.find((b) => b.staffId === r.staffId)) : null;
      return {
        ...r,
        requesterBalance: bal,
      };
    });

  res.json({
    departmentId: deptId,
    selectedDate,
    canManageRegister,
    canApproveLeaves: hasPermission(user, 'requests', 'approve'),
    myLeaveBalance: myBalance,
    myAttendanceHistory,
    staffRegister,
    staffLeaveRequests,
    recentDates: Array.from(new Set(deptAttendanceDates)).sort((a, b) => b.localeCompare(a)).slice(0, 7),
  });
});

apiRouter.post('/staff-attendance/mark', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const canManage =
    user.roles.includes('HOD') ||
    isInstitutionWideUser(user) ||
    hasPermission(user, 'staff', 'edit');
  if (!canManage) {
    res.status(403).json({ error: 'Only HOD or College Admin can mark department staff attendance.' });
    return;
  }

  const db = getDb();
  const { departmentId, date, records } = req.body as {
    departmentId?: string;
    date: string;
    records: {
      staffId: string;
      status: StaffAttendanceStatus;
      checkInTime?: string;
      remarks?: string;
    }[];
  };
  const deptId = resolveDepartmentScope(user, departmentId);
  if (!date || !Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: 'Date and staff attendance records are required.' });
    return;
  }

  for (const rec of records) {
    const existing = db.staffAttendance.find(
      (a) => a.departmentId === deptId && a.staffId === rec.staffId && a.date === date
    );
    if (existing) {
      existing.status = rec.status;
      existing.checkInTime = rec.checkInTime || existing.checkInTime;
      existing.remarks = rec.remarks;
      existing.markedByName = user.fullName;
    } else {
      db.staffAttendance.unshift({
        id: `sa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        departmentId: deptId,
        staffId: rec.staffId,
        date,
        status: rec.status,
        checkInTime: rec.checkInTime || (rec.status === 'ABSENT' || rec.status === 'ON_LEAVE' ? undefined : '08:55'),
        remarks: rec.remarks,
        markedByName: user.fullName,
      });
    }
  }
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: deptId,
    action: 'STAFF_ATTENDANCE_SAVED',
    module: 'staff',
    entityType: 'StaffAttendance',
    entityId: `${deptId}:${date}`,
    summary: `Saved daily staff attendance register for ${date} (${records.length} staff members).`,
  });
  res.json({ savedCount: records.length, date });
});

// Requests & Approval Centre
apiRouter.get('/requests', requireAuth, requirePermission('requests', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  let list = db.requests.filter((r) => r.departmentId === deptId);
  if (user.roles.includes('STUDENT') && user.studentId) {
    list = list.filter((r) => r.studentId === user.studentId || r.requesterUserId === user.id);
  }
  res.json({ requests: list });
});

apiRouter.post('/requests', requireAuth, requirePermission('requests', 'create'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const { type, title, description, fromDate, toDate, leaveCategory } = req.body as {
    type: typeof db.requests[number]['type'];
    title: string;
    description: string;
    fromDate?: string;
    toDate?: string;
    leaveCategory?: LeaveCategory;
  };
  if (!type || !title) {
    res.status(400).json({ error: 'Request type and title are required.' });
    return;
  }

  const daysCount = type === 'STAFF_LEAVE' ? calculateInclusiveDays(fromDate, toDate) : undefined;
  const resolvedCategory: LeaveCategory | undefined =
    type === 'STAFF_LEAVE' ? leaveCategory || 'CL' : undefined;

  if (type === 'STAFF_LEAVE' && user.staffId && resolvedCategory && daysCount) {
    const bal = formatLeaveBalance(db.staffLeaveBalances.find((b) => b.staffId === user.staffId));
    const available =
      resolvedCategory === 'CL'
        ? bal.clAvailable
        : resolvedCategory === 'ML'
        ? bal.mlAvailable
        : bal.odAvailable;
    if (daysCount > available) {
      res.status(400).json({
        error: `Insufficient ${resolvedCategory} leave balance: requested ${daysCount} day(s), only ${available} day(s) available.`,
      });
      return;
    }
  }

  const newReq: typeof db.requests[number] = {
    id: `req-${Date.now()}`,
    requestNumber: `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    departmentId: user.departmentId,
    type,
    requesterUserId: user.id,
    requesterName: user.fullName,
    requesterRole: user.roles[0],
    studentId: user.studentId,
    staffId: user.staffId,
    leaveCategory: resolvedCategory,
    daysCount,
    title: title.trim(),
    description: description || '',
    fromDate,
    toDate,
    status: 'SUBMITTED',
    assignedApproverRole: 'HOD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [
      {
        timestamp: new Date().toISOString(),
        actorName: user.fullName,
        action: 'SUBMITTED',
        comment:
          type === 'STAFF_LEAVE'
            ? `Requested ${daysCount} day(s) of ${resolvedCategory} leave.`
            : 'Request submitted for review.',
      },
    ],
  };
  db.requests.unshift(newReq);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: newReq.departmentId,
    action: 'REQUEST_SUBMITTED',
    module: 'requests',
    entityType: 'ApprovalRequest',
    entityId: newReq.id,
    summary: `Submitted ${newReq.requestNumber} (${newReq.type}): ${newReq.title}.`,
  });
  res.status(201).json({ request: newReq });
});

apiRouter.patch('/requests/:id/decision', requireAuth, requirePermission('requests', 'approve'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const item = db.requests.find((r) => r.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Request not found.' });
    return;
  }
  if (!isInstitutionWideUser(user) && item.departmentId !== user.departmentId) {
    res.status(403).json({ error: 'Cross-department approval denied.' });
    return;
  }
  const { decision, comment } = (req.body || {}) as {
    decision?: 'APPROVED' | 'REJECTED' | 'NEED_MORE_INFO';
    comment?: string;
  };
  if (!decision || !['APPROVED', 'REJECTED', 'NEED_MORE_INFO'].includes(decision)) {
    res.status(400).json({ error: 'Valid decision (APPROVED, REJECTED, NEED_MORE_INFO) is required.' });
    return;
  }

  let balanceNote = '';
  if (decision === 'APPROVED' && item.status !== 'APPROVED' && item.type === 'STAFF_LEAVE' && item.staffId) {
    const cat = item.leaveCategory || 'CL';
    const days = item.daysCount || calculateInclusiveDays(item.fromDate, item.toDate);
    let bal = db.staffLeaveBalances.find((b) => b.staffId === item.staffId);
    if (!bal) {
      bal = {
        staffId: item.staffId,
        departmentId: item.departmentId,
        academicYearId: db.institution.activeAcademicYearId,
        clTotal: 12,
        clUsed: 0,
        mlTotal: 10,
        mlUsed: 0,
        odTotal: 15,
        odUsed: 0,
      };
      db.staffLeaveBalances.push(bal);
    }
    const formatted = formatLeaveBalance(bal);
    const available =
      cat === 'CL' ? formatted.clAvailable : cat === 'ML' ? formatted.mlAvailable : formatted.odAvailable;
    if (days > available) {
      res.status(409).json({
        error: `Cannot approve: ${item.requesterName} has only ${available} ${cat} day(s) remaining (${days} requested).`,
      });
      return;
    }
    if (cat === 'CL') bal.clUsed += days;
    else if (cat === 'ML') bal.mlUsed += days;
    else bal.odUsed += days;

    balanceNote = ` Deducted ${days} day(s) from ${cat} balance.`;
    if (item.fromDate) {
      const attRec = db.staffAttendance.find(
        (a) => a.departmentId === item.departmentId && a.staffId === item.staffId && a.date === item.fromDate
      );
      if (attRec) {
        attRec.status = cat === 'OD' ? 'ON_DUTY' : 'ON_LEAVE';
        attRec.remarks = `${cat} Leave Approved (${item.requestNumber})`;
        attRec.markedByName = user.fullName;
      } else {
        db.staffAttendance.unshift({
          id: `sa-${Date.now()}`,
          departmentId: item.departmentId,
          staffId: item.staffId,
          date: item.fromDate,
          status: cat === 'OD' ? 'ON_DUTY' : 'ON_LEAVE',
          remarks: `${cat} Leave Approved (${item.requestNumber})`,
          markedByName: user.fullName,
        });
      }
    }
  }

  item.status = decision;
  item.updatedAt = new Date().toISOString();
  item.history.push({
    timestamp: new Date().toISOString(),
    actorName: user.fullName,
    action: decision,
    comment: `${comment || `Marked ${decision} by ${user.fullName}.`}${balanceNote}`,
  });
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: item.departmentId,
    action: `REQUEST_${decision}`,
    module: 'requests',
    entityType: 'ApprovalRequest',
    entityId: item.id,
    summary: `${decision} ${item.requestNumber} (${item.title}).${balanceNote}`,
  });
  res.json({ request: item });
});

// Fees & Payment Ledger
apiRouter.get('/fees', requireAuth, requirePermission('fees', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  let ledgers = db.feeLedgers.filter((f) => f.departmentId === deptId);
  if (user.roles.includes('STUDENT') && user.studentId) {
    ledgers = ledgers.filter((f) => f.studentId === user.studentId);
  }
  const enriched = ledgers.map((f) => {
    const st = db.students.find((s) => s.id === f.studentId);
    return {
      ...f,
      studentName: st?.fullName || '',
      registerNumber: st?.registerNumber || '',
      balanceAmount: f.totalAmount - f.concessionAmount - f.paidAmount,
    };
  });
  res.json({ ledgers: enriched });
});

apiRouter.post('/fees/:id/pay', requireAuth, requirePermission('fees', 'submit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const ledger = db.feeLedgers.find((f) => f.id === req.params.id);
  if (!ledger) {
    res.status(404).json({ error: 'Fee ledger not found.' });
    return;
  }
  if (user.roles.includes('STUDENT') && user.studentId !== ledger.studentId) {
    res.status(403).json({ error: 'Cannot pay another student’s fee ledger.' });
    return;
  }
  const balance = ledger.totalAmount - ledger.concessionAmount - ledger.paidAmount;
  const amount = Math.min(balance, Math.max(1, Number(req.body.amount) || balance));
  const mode = (req.body.mode as 'UPI' | 'NET_BANKING' | 'CARD' | 'CHALLAN') || 'UPI';

  const payment = {
    id: `pay-${Date.now()}`,
    receiptNumber: `VIT-RCPT-2026-${Math.floor(5000 + Math.random() * 4999)}`,
    transactionRef: `TXN${Date.now().toString().slice(-8)}`,
    amount,
    mode,
    paidAt: new Date().toISOString(),
  };
  ledger.payments.unshift(payment);
  ledger.paidAmount += amount;
  const remaining = ledger.totalAmount - ledger.concessionAmount - ledger.paidAmount;
  ledger.status = remaining <= 0 ? 'PAID' : 'PARTIAL';
  saveDb();

  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: ledger.departmentId,
    action: 'FEE_PAYMENT_RECORDED',
    module: 'fees',
    entityType: 'StudentFeeLedger',
    entityId: ledger.id,
    summary: `Recorded ₹${amount.toLocaleString('en-IN')} payment (${payment.receiptNumber}) via ${mode}.`,
  });
  res.json({ ledger, payment });
});

// Department Operations (Projects, Internships, Placement, Events, Research, IQAC, Labs)
apiRouter.get('/operations/overview', requireAuth, requirePermission('operations', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);

  res.json({
    projects: db.projects
      .filter((p) => p.departmentId === deptId)
      .map((p) => ({
        ...p,
        guideName: db.staff.find((s) => s.id === p.guideStaffId)?.fullName || '',
        teamNames: p.studentIds.map((id) => db.students.find((st) => st.id === id)?.fullName || id),
      })),
    internships: db.internships
      .filter((i) => i.departmentId === deptId)
      .map((i) => ({
        ...i,
        studentName: db.students.find((st) => st.id === i.studentId)?.fullName || '',
        registerNumber: db.students.find((st) => st.id === i.studentId)?.registerNumber || '',
      })),
    jobOpenings: db.jobOpenings.filter((j) => j.departmentId === deptId),
    events: db.events
      .filter((e) => e.departmentId === deptId)
      .map((e) => ({
        ...e,
        coordinatorName: db.staff.find((s) => s.id === e.coordinatorStaffId)?.fullName || '',
        registeredCount: e.registeredUserIds.length,
        isRegistered: e.registeredUserIds.includes(user.id),
      })),
    publications: db.publications
      .filter((p) => p.departmentId === deptId)
      .map((p) => ({
        ...p,
        facultyName: db.staff.find((s) => s.id === p.staffId)?.fullName || '',
      })),
    accreditationEvidence: db.accreditationEvidence
      .filter((a) => a.departmentId === deptId)
      .map((a) => ({
        ...a,
        ownerName: db.staff.find((s) => s.id === a.ownerStaffId)?.fullName || '',
      })),
    labAssets: db.labAssets
      .filter((l) => l.departmentId === deptId)
      .map((l) => ({
        ...l,
        inChargeName: db.staff.find((s) => s.id === l.inChargeStaffId)?.fullName || '',
      })),
    mentorMeetings: db.mentorMeetings
      .filter((m) => m.departmentId === deptId)
      .filter((m) => (!user.roles.includes('STUDENT') ? true : m.studentId === user.studentId))
      .map((m) => ({
        ...m,
        mentorName: db.staff.find((s) => s.id === m.mentorStaffId)?.fullName || '',
        studentName: db.students.find((st) => st.id === m.studentId)?.fullName || '',
      })),
  });
});

apiRouter.post('/operations/events/:id/register', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const evt = db.events.find((e) => e.id === req.params.id);
  if (!evt) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }
  if (!evt.registeredUserIds.includes(user.id)) {
    evt.registeredUserIds.push(user.id);
    saveDb();
  }
  res.json({ event: evt });
});

apiRouter.patch('/operations/events/:id/approve', requireAuth, requirePermission('operations', 'approve'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const evt = db.events.find((e) => e.id === req.params.id);
  if (!evt) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }
  evt.status = 'APPROVED';
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: evt.departmentId,
    action: 'EVENT_APPROVED',
    module: 'operations',
    entityType: 'DepartmentEvent',
    entityId: evt.id,
    summary: `Approved department event "${evt.title}".`,
  });
  res.json({ event: evt });
});

apiRouter.post('/operations/jobs/:id/apply', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const job = db.jobOpenings.find((j) => j.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job opening not found.' });
    return;
  }
  if (!user.studentId) {
    res.status(403).json({ error: 'Only student accounts can apply for campus placement drives.' });
    return;
  }
  const student = db.students.find((s) => s.id === user.studentId);
  if (student && student.cgpa < job.minCgpa) {
    res.status(400).json({ error: `Eligibility check failed: Minimum CGPA ${job.minCgpa} required.` });
    return;
  }
  if (!job.applicantStudentIds.includes(user.studentId)) {
    job.applicantStudentIds.push(user.studentId);
    saveDb();
  }
  res.json({ job });
});

apiRouter.patch('/operations/iqac/:id/verify', requireAuth, requirePermission('operations', 'verify'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const item = db.accreditationEvidence.find((a) => a.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Evidence record not found.' });
    return;
  }
  const { status, reviewerNotes } = req.body as { status: 'VERIFIED' | 'NEEDS_REVISION'; reviewerNotes?: string };
  item.status = status;
  if (status === 'VERIFIED') item.completionPct = 100;
  if (reviewerNotes) item.reviewerNotes = reviewerNotes;
  item.updatedAt = new Date().toISOString().slice(0, 10);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: item.departmentId,
    action: `IQAC_EVIDENCE_${status}`,
    module: 'operations',
    entityType: 'AccreditationEvidence',
    entityId: item.id,
    summary: `Marked ${item.framework} ${item.criterionCode} as ${status}.`,
  });
  res.json({ evidence: item });
});

apiRouter.patch('/operations/labs/:id/maintenance', requireAuth, requirePermission('operations', 'edit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const lab = db.labAssets.find((l) => l.id === req.params.id);
  if (!lab) {
    res.status(404).json({ error: 'Lab asset not found.' });
    return;
  }
  const { condition, maintenanceTicketStatus } = req.body as {
    condition: 'OPERATIONAL' | 'MAINTENANCE_DUE' | 'OUT_OF_ORDER';
    maintenanceTicketStatus: 'NONE' | 'OPEN' | 'RESOLVED';
  };
  lab.condition = condition;
  lab.maintenanceTicketStatus = maintenanceTicketStatus;
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: lab.departmentId,
    action: 'LAB_ASSET_UPDATED',
    module: 'operations',
    entityType: 'LabAsset',
    entityId: lab.id,
    summary: `Updated ${lab.assetCode} status to ${condition} (Ticket: ${maintenanceTicketStatus}).`,
  });
  res.json({ labAsset: lab });
});

// Announcements
apiRouter.get('/announcements', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);
  res.json({
    announcements: db.announcements.filter((a) => a.departmentId === 'ALL' || a.departmentId === deptId),
  });
});

apiRouter.post('/announcements', requireAuth, requirePermission('operations', 'create'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const { title, body, category, targetAudience } = req.body as {
    title: string;
    body: string;
    category: 'ACADEMIC' | 'EXAMINATION' | 'PLACEMENT' | 'EVENT' | 'GENERAL';
    targetAudience: 'ALL' | 'STUDENTS' | 'FACULTY';
  };
  if (!title || !body) {
    res.status(400).json({ error: 'Title and message body are required.' });
    return;
  }
  const newAnn = {
    id: `ann-${Date.now()}`,
    institutionId: db.institution.id,
    departmentId: isInstitutionWideUser(user) ? ('ALL' as const) : user.departmentId,
    title: title.trim(),
    body: body.trim(),
    category: category || 'GENERAL',
    targetAudience: targetAudience || 'ALL',
    authorName: user.fullName,
    authorRole: user.roles[0],
    createdAt: new Date().toISOString(),
  };
  db.announcements.unshift(newAnn);
  saveDb();
  res.status(201).json({ announcement: newAnn });
});

// RBAC Matrix, Users & Settings (Admin Governance)
apiRouter.get('/rbac/matrix', requireAuth, requirePermission('rbac', 'view'), (_req, res) => {
  const db = getDb();
  const safeUsers = db.users.map((u) => toSafeUser(u, db.rbacMatrix));
  res.json({
    roles: db.roles,
    matrix: db.rbacMatrix,
    users: safeUsers,
  });
});

apiRouter.patch('/rbac/permissions', requireAuth, requirePermission('rbac', 'edit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const { role, module, actions } = req.body as {
    role: RoleCode;
    module: ModuleCode;
    actions: PermissionAction[];
  };
  if (role === 'SUPER_ADMIN') {
    res.status(400).json({ error: 'Super Admin baseline permissions cannot be restricted.' });
    return;
  }
  if (!db.rbacMatrix[role]) db.rbacMatrix[role] = {};
  db.rbacMatrix[role][module] = actions;
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: user.departmentId,
    action: 'RBAC_MATRIX_UPDATED',
    module: 'rbac',
    entityType: 'RolePermissionMatrix',
    entityId: `${role}:${module}`,
    summary: `Updated ${role} permissions on "${module}" to [${actions.join(', ') || 'none'}].`,
  });
  res.json({ matrix: db.rbacMatrix });
});

apiRouter.patch('/users/:id/roles', requireAuth, requirePermission('rbac', 'edit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'User account not found.' });
    return;
  }
  const { roles, status } = req.body as { roles?: RoleCode[]; status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' };
  if (roles && roles.length > 0) target.roles = roles;
  if (status) target.status = status;
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: target.departmentId,
    action: 'USER_ACCESS_UPDATED',
    module: 'rbac',
    entityType: 'UserAccount',
    entityId: target.id,
    summary: `Updated ${target.fullName} roles=[${target.roles.join(', ')}] status=${target.status}.`,
  });
  res.json({ user: toSafeUser(target, db.rbacMatrix) });
});

apiRouter.get('/settings', requireAuth, requirePermission('settings', 'view'), (_req, res) => {
  const db = getDb();
  res.json({
    institution: db.institution,
    departments: db.departments,
    regulations: db.regulations,
    academicYears: db.academicYears,
  });
});

apiRouter.patch('/settings', requireAuth, requirePermission('settings', 'edit'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const { name, attendanceThresholdPct, passMarkPct, accreditationNote } = req.body as {
    name?: string;
    attendanceThresholdPct?: number;
    passMarkPct?: number;
    accreditationNote?: string;
  };
  if (name) db.institution.name = name.trim();
  if (typeof attendanceThresholdPct === 'number') {
    db.institution.attendanceThresholdPct = Math.max(50, Math.min(95, attendanceThresholdPct));
  }
  if (typeof passMarkPct === 'number') {
    db.institution.passMarkPct = Math.max(35, Math.min(75, passMarkPct));
  }
  if (accreditationNote !== undefined) db.institution.accreditationNote = accreditationNote;
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: user.departmentId,
    action: 'INSTITUTION_SETTINGS_UPDATED',
    module: 'settings',
    entityType: 'Institution',
    entityId: db.institution.id,
    summary: `Updated institution policies (Attendance threshold: ${db.institution.attendanceThresholdPct}%, Pass mark: ${db.institution.passMarkPct}%).`,
  });
  res.json({ institution: db.institution });
});

apiRouter.post('/settings/reset-demo', requireAuth, requirePermission('settings', 'edit'), (req: AuthenticatedRequest, res) => {
  const fresh = resetDbToSeed();
  res.json({ message: 'Demo database reset to clean initial state.', departments: fresh.departments });
});

apiRouter.get('/audit-logs', requireAuth, requirePermission('audit', 'view'), (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const logs = isInstitutionWideUser(user)
    ? db.auditLogs
    : db.auditLogs.filter((l) => l.departmentId === user.departmentId);
  res.json({ auditLogs: logs });
});

// =========================================================================
// Documents & Certificates Vault (Students + Staff Upload / View / Download / Verify)
// =========================================================================

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDocumentPreviewSvg(doc: VaultDocument, institutionName: string, deptName: string): string {
  const badgeColor =
    doc.verificationStatus === 'VERIFIED'
      ? '#047857'
      : doc.verificationStatus === 'REJECTED'
      ? '#b91c1c'
      : '#b45309';
  const badgeBg =
    doc.verificationStatus === 'VERIFIED'
      ? '#ecfdf5'
      : doc.verificationStatus === 'REJECTED'
      ? '#fef2f2'
      : '#fffbeb';
  const sectionLabel =
    doc.section === 'DOCUMENT' ? 'OFFICIAL IDENTITY & PERSONAL DOCUMENT RECORD' : 'ACADEMIC & ACHIEVEMENT CERTIFICATE RECORD';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="580" viewBox="0 0 900 580">
  <rect width="900" height="580" fill="#f8fafc"/>
  <rect x="28" y="28" width="844" height="524" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="28" y="28" width="844" height="92" rx="12" fill="#0f172a"/>
  <rect x="28" y="102" width="844" height="18" fill="#0f172a"/>
  <text x="64" y="68" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${escapeXml(institutionName)}</text>
  <text x="64" y="95" font-family="Arial, sans-serif" font-size="13" fill="#94a3b8">${escapeXml(sectionLabel)} · ${escapeXml(deptName)}</text>

  <rect x="640" y="52" width="196" height="38" rx="6" fill="${badgeBg}"/>
  <text x="738" y="76" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="${badgeColor}">${escapeXml(doc.verificationStatus)}</text>

  <text x="64" y="168" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#1d4ed8">${escapeXml(doc.category.replace(/_/g, ' '))}</text>
  <text x="64" y="200" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#0f172a">${escapeXml(doc.title)}</text>
  <line x1="64" y1="226" x2="836" y2="226" stroke="#e2e8f0" stroke-width="1.5"/>

  <text x="64" y="264" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Holder Name</text>
  <text x="64" y="288" font-family="Arial, sans-serif" font-size="17" font-weight="600" fill="#0f172a">${escapeXml(doc.ownerName)}</text>

  <text x="480" y="264" font-family="Arial, sans-serif" font-size="12" fill="#64748b">${doc.ownerType === 'STUDENT' ? 'Register Number' : 'Staff Code'}</text>
  <text x="480" y="288" font-family="Arial, sans-serif" font-size="17" font-weight="600" fill="#0f172a">${escapeXml(doc.ownerCode)} (${escapeXml(doc.ownerType)})</text>

  <text x="64" y="344" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Document / Serial Number</text>
  <text x="64" y="368" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#0f172a">${escapeXml(doc.documentNumber || 'On File')}</text>

  <text x="480" y="344" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Issuing Authority</text>
  <text x="480" y="368" font-family="Arial, sans-serif" font-size="15" font-weight="600" fill="#0f172a">${escapeXml(doc.issuingAuthority || 'Institutional / Govt Authority')}</text>

  <text x="64" y="424" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Issue Date</text>
  <text x="64" y="448" font-family="Arial, sans-serif" font-size="15" font-weight="600" fill="#0f172a">${escapeXml(doc.issueDate || doc.uploadedAt.slice(0, 10))}</text>

  <text x="480" y="424" font-family="Arial, sans-serif" font-size="12" fill="#64748b">${doc.verifiedByName ? 'Verified By' : 'Uploaded By'}</text>
  <text x="480" y="448" font-family="Arial, sans-serif" font-size="15" font-weight="600" fill="#0f172a">${escapeXml(doc.verifiedByName || doc.uploadedByName)}</text>

  <line x1="64" y1="482" x2="836" y2="482" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="64" y="516" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Vault File: ${escapeXml(doc.fileName)} · Uploaded ${escapeXml(doc.uploadedAt.slice(0, 10))}</text>
  <text x="836" y="516" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#1d4ed8">Vanguard ERP Verified Vault Copy</text>
</svg>`;
}

apiRouter.get('/documents', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const isStudent = user.roles.includes('STUDENT') && !user.staffId;
  const deptId = resolveDepartmentScope(user, req.query.departmentId as string | undefined);

  const section = (req.query.section as string | undefined) || 'ALL';
  const ownerType = (req.query.ownerType as string | undefined) || 'ALL';
  const ownerId = (req.query.ownerId as string | undefined) || '';
  const category = (req.query.category as string | undefined) || 'ALL';
  const verificationStatus = (req.query.verificationStatus as string | undefined) || 'ALL';
  const yearOfStudy = req.query.yearOfStudy ? Number(req.query.yearOfStudy) : undefined;
  const search = ((req.query.search as string | undefined) || '').trim().toLowerCase();

  let docs = db.vaultDocuments.filter((d) =>
    deptId === 'ALL' && isInstitutionWideUser(user) ? true : d.departmentId === deptId
  );

  if (isStudent && user.studentId) {
    docs = docs.filter((d) => d.ownerType === 'STUDENT' && d.ownerId === user.studentId);
  }

  // Summary across all visible docs before narrow search/category filters
  const summaryPool = section !== 'ALL' ? docs.filter((d) => d.section === section) : docs;
  const summary = {
    totalCount: summaryPool.length,
    verifiedCount: summaryPool.filter((d) => d.verificationStatus === 'VERIFIED').length,
    pendingCount: summaryPool.filter((d) => d.verificationStatus === 'PENDING').length,
    rejectedCount: summaryPool.filter((d) => d.verificationStatus === 'REJECTED').length,
    studentDocsCount: summaryPool.filter((d) => d.ownerType === 'STUDENT').length,
    staffDocsCount: summaryPool.filter((d) => d.ownerType === 'STAFF').length,
  };

  if (section !== 'ALL') docs = docs.filter((d) => d.section === section);
  if (ownerType !== 'ALL') docs = docs.filter((d) => d.ownerType === ownerType);
  if (ownerId) docs = docs.filter((d) => d.ownerId === ownerId);
  if (category !== 'ALL') docs = docs.filter((d) => d.category === category);
  if (verificationStatus !== 'ALL') docs = docs.filter((d) => d.verificationStatus === verificationStatus);
  if (yearOfStudy) docs = docs.filter((d) => d.ownerType === 'STUDENT' && d.yearOfStudy === yearOfStudy);
  if (search) {
    docs = docs.filter(
      (d) =>
        d.title.toLowerCase().includes(search) ||
        d.ownerName.toLowerCase().includes(search) ||
        d.ownerCode.toLowerCase().includes(search) ||
        d.category.toLowerCase().includes(search) ||
        (d.documentNumber || '').toLowerCase().includes(search) ||
        (d.issuingAuthority || '').toLowerCase().includes(search)
    );
  }

  const sanitized = docs
    .slice()
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map(({ fileDataUrl, ...rest }) => ({
      ...rest,
      hasUploadedFile: Boolean(fileDataUrl),
    }));

  const deptStudents = isStudent
    ? []
    : db.students
        .filter((s) => (deptId === 'ALL' && isInstitutionWideUser(user) ? true : s.departmentId === deptId))
        .map((s) => ({
          id: s.id,
          registerNumber: s.registerNumber,
          fullName: s.fullName,
          yearOfStudy: getYearOfStudy(s.semester),
        }));

  const deptStaff = isStudent
    ? []
    : db.staff
        .filter((st) => (deptId === 'ALL' && isInstitutionWideUser(user) ? true : st.departmentId === deptId))
        .map((st) => ({
          id: st.id,
          staffCode: st.staffCode,
          fullName: st.fullName,
          designation: st.designation,
        }));

  res.json({
    departmentId: deptId,
    isStudent,
    canVerify: !isStudent && (hasPermission(user, 'documents', 'verify') || user.roles.includes('HOD') || isInstitutionWideUser(user) || user.roles.includes('FACULTY') || user.roles.includes('NON_TEACHING_STAFF')),
    summary,
    documents: sanitized,
    students: deptStudents,
    staff: deptStaff,
  });
});

apiRouter.post('/documents', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const isStudent = user.roles.includes('STUDENT') && !user.staffId;
  const body = req.body as {
    departmentId?: string;
    section: VaultSection;
    ownerType?: 'STUDENT' | 'STAFF';
    ownerId?: string;
    category: DocumentCategory;
    title: string;
    documentNumber?: string;
    issuingAuthority?: string;
    issueDate?: string;
    expiryDate?: string;
    fileName?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    fileDataUrl?: string;
  };

  if (!body.section || !body.category || !body.title?.trim()) {
    res.status(400).json({ error: 'Section, category, and document title are required.' });
    return;
  }

  if (body.fileDataUrl && body.fileDataUrl.length > 6_500_000) {
    res.status(400).json({ error: 'File size exceeds 4 MB limit. Please upload a smaller PDF or image.' });
    return;
  }

  let resolvedDeptId = resolveDepartmentScope(user, body.departmentId);
  if (resolvedDeptId === 'ALL') {
    resolvedDeptId = user.departmentId;
  }

  let ownerType: 'STUDENT' | 'STAFF' = body.ownerType === 'STAFF' ? 'STAFF' : 'STUDENT';
  let ownerId = body.ownerId || '';
  let ownerCode = '';
  let ownerName = user.fullName;
  let yearOfStudy: number | undefined;

  if (isStudent) {
    if (!user.studentId) {
      res.status(403).json({ error: 'Student profile not linked.' });
      return;
    }
    const stu = db.students.find((s) => s.id === user.studentId);
    if (!stu) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }
    ownerType = 'STUDENT';
    ownerId = stu.id;
    ownerCode = stu.registerNumber;
    ownerName = stu.fullName;
    yearOfStudy = getYearOfStudy(stu.semester);
    resolvedDeptId = stu.departmentId;
  } else {
    if (!ownerId && user.staffId) {
      ownerType = 'STAFF';
      ownerId = user.staffId;
    }
    if (ownerType === 'STUDENT') {
      const stu = db.students.find((s) => s.id === ownerId);
      if (!stu) {
        res.status(404).json({ error: 'Selected student not found.' });
        return;
      }
      if (!isInstitutionWideUser(user) && stu.departmentId !== user.departmentId) {
        res.status(403).json({ error: 'Cannot upload documents for a student outside your department.' });
        return;
      }
      ownerCode = stu.registerNumber;
      ownerName = stu.fullName;
      yearOfStudy = getYearOfStudy(stu.semester);
      resolvedDeptId = stu.departmentId;
    } else {
      const st = db.staff.find((s) => s.id === ownerId);
      if (!st) {
        res.status(404).json({ error: 'Selected staff profile not found.' });
        return;
      }
      if (!isInstitutionWideUser(user) && st.departmentId !== user.departmentId) {
        res.status(403).json({ error: 'Cannot upload documents for staff outside your department.' });
        return;
      }
      ownerCode = st.staffCode;
      ownerName = st.fullName;
      resolvedDeptId = st.departmentId;
    }
  }

  const safeFileName = (body.fileName || `${ownerCode}_${body.category}.svg`).replace(/[^\w.\-() ]+/g, '_');
  const newDoc: VaultDocument = {
    id: `vdoc-${Date.now()}`,
    departmentId: resolvedDeptId,
    section: body.section,
    ownerType,
    ownerId,
    ownerCode,
    ownerName,
    yearOfStudy,
    category: body.category,
    title: body.title.trim(),
    documentNumber: body.documentNumber?.trim() || undefined,
    issuingAuthority: body.issuingAuthority?.trim() || undefined,
    issueDate: body.issueDate || undefined,
    expiryDate: body.expiryDate || undefined,
    fileName: safeFileName,
    mimeType: body.mimeType || 'image/svg+xml',
    fileSizeBytes: body.fileSizeBytes || 128000,
    fileDataUrl: body.fileDataUrl || undefined,
    verificationStatus: 'PENDING',
    uploadedByUserId: user.id,
    uploadedByName: user.fullName,
    uploadedAt: new Date().toISOString(),
  };

  db.vaultDocuments.unshift(newDoc);
  saveDb();

  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: resolvedDeptId,
    action: 'DOCUMENT_UPLOADED',
    module: 'documents',
    entityType: 'VaultDocument',
    entityId: newDoc.id,
    summary: `Uploaded ${newDoc.section.toLowerCase()} "${newDoc.title}" (${newDoc.category}) for ${ownerName} (${ownerCode}).`,
  });

  const { fileDataUrl: _omit, ...sanitized } = newDoc;
  res.status(201).json({ document: { ...sanitized, hasUploadedFile: Boolean(_omit) } });
});

apiRouter.get('/documents/:id/file', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const doc = db.vaultDocuments.find((d) => d.id === req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  const isStudent = user.roles.includes('STUDENT') && !user.staffId;
  if (isStudent) {
    if (doc.ownerType !== 'STUDENT' || doc.ownerId !== user.studentId) {
      res.status(403).json({ error: 'Students can only view or download their own documents.' });
      return;
    }
  } else if (!isInstitutionWideUser(user) && doc.departmentId !== user.departmentId) {
    res.status(403).json({ error: 'Cross-department document access denied.' });
    return;
  }

  const downloadMode = req.query.download === '1' || req.query.download === 'true';
  const safeName = doc.fileName.replace(/["\r\n]/g, '_');

  if (doc.fileDataUrl && doc.fileDataUrl.startsWith('data:')) {
    const commaIdx = doc.fileDataUrl.indexOf(',');
    if (commaIdx > -1) {
      const header = doc.fileDataUrl.slice(5, commaIdx);
      const mime = header.split(';')[0] || doc.mimeType || 'application/octet-stream';
      const base64 = doc.fileDataUrl.slice(commaIdx + 1);
      const buf = Buffer.from(base64, 'base64');
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `${downloadMode ? 'attachment' : 'inline'}; filename="${safeName}"`);
      res.send(buf);
      return;
    }
  }

  const dept = db.departments.find((d) => d.id === doc.departmentId);
  const svg = buildDocumentPreviewSvg(doc, db.institution.name, dept?.name || doc.departmentId);
  const svgFileName = safeName.endsWith('.svg') ? safeName : `${safeName}.svg`;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Content-Disposition', `${downloadMode ? 'attachment' : 'inline'}; filename="${svgFileName}"`);
  res.send(svg);
});

apiRouter.patch('/documents/:id/verify', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const isStudent = user.roles.includes('STUDENT') && !user.staffId;
  const allowed =
    !isStudent &&
    (hasPermission(user, 'documents', 'verify') ||
      user.roles.includes('HOD') ||
      isInstitutionWideUser(user) ||
      user.roles.includes('FACULTY') ||
      user.roles.includes('NON_TEACHING_STAFF'));
  if (!allowed) {
    res.status(403).json({ error: 'Only faculty, staff, HOD, or Admin can verify documents.' });
    return;
  }

  const db = getDb();
  const doc = db.vaultDocuments.find((d) => d.id === req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }
  if (!isInstitutionWideUser(user) && doc.departmentId !== user.departmentId) {
    res.status(403).json({ error: 'Cross-department document verification denied.' });
    return;
  }

  const { status, remarks } = (req.body || {}) as {
    status?: 'VERIFIED' | 'REJECTED' | 'PENDING';
    remarks?: string;
  };
  if (!status || !['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) {
    res.status(400).json({ error: 'Valid verification status (VERIFIED, REJECTED, PENDING) is required.' });
    return;
  }

  doc.verificationStatus = status;
  doc.verifiedByName = user.fullName;
  doc.verifiedAt = new Date().toISOString();
  doc.verificationRemarks = remarks?.trim() || (status === 'VERIFIED' ? 'Verified against record.' : 'Re-upload requested.');

  if (doc.ownerType === 'STUDENT') {
    const stu = db.students.find((s) => s.id === doc.ownerId);
    if (stu) {
      const stuDocs = db.vaultDocuments.filter((d) => d.ownerType === 'STUDENT' && d.ownerId === stu.id);
      stu.documentsVerified = stuDocs.length > 0 && stuDocs.every((d) => d.verificationStatus === 'VERIFIED');
    }
  }

  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: doc.departmentId,
    action: `DOCUMENT_${status}`,
    module: 'documents',
    entityType: 'VaultDocument',
    entityId: doc.id,
    summary: `Marked "${doc.title}" for ${doc.ownerName} (${doc.ownerCode}) as ${status}.`,
  });

  const { fileDataUrl: _omit, ...sanitized } = doc;
  res.json({ document: { ...sanitized, hasUploadedFile: Boolean(_omit) } });
});

apiRouter.delete('/documents/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const db = getDb();
  const idx = db.vaultDocuments.findIndex((d) => d.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }
  const doc = db.vaultDocuments[idx];
  const isOwner = doc.uploadedByUserId === user.id || (user.studentId && doc.ownerId === user.studentId);
  const canDelete = isInstitutionWideUser(user) || (user.roles.includes('HOD') && doc.departmentId === user.departmentId) || (isOwner && doc.verificationStatus !== 'VERIFIED');
  if (!canDelete) {
    res.status(403).json({ error: 'Verified documents can only be removed by HOD or College Admin.' });
    return;
  }

  db.vaultDocuments.splice(idx, 1);
  saveDb();
  addAuditLog({
    actorUserId: user.id,
    actorName: user.fullName,
    actorRoles: user.roles,
    departmentId: doc.departmentId,
    action: 'DOCUMENT_DELETED',
    module: 'documents',
    entityType: 'VaultDocument',
    entityId: doc.id,
    summary: `Removed ${doc.section.toLowerCase()} "${doc.title}" (${doc.ownerCode}).`,
  });
  res.json({ deletedId: doc.id });
});

