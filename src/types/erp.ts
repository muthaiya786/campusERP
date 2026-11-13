export type RoleCode =
  | 'SUPER_ADMIN'
  | 'COLLEGE_ADMIN'
  | 'PRINCIPAL'
  | 'HOD'
  | 'ASSISTANT_HOD'
  | 'FACULTY'
  | 'NON_TEACHING_STAFF'
  | 'CLASS_ADVISOR'
  | 'EXAM_COORDINATOR'
  | 'PLACEMENT_COORDINATOR'
  | 'IQAC_COORDINATOR'
  | 'LAB_INCHARGE'
  | 'STUDENT';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'export'
  | 'verify'
  | 'assign';

export type ModuleCode =
  | 'dashboard'
  | 'students'
  | 'staff'
  | 'academics'
  | 'timetable'
  | 'attendance'
  | 'assignments'
  | 'assessments'
  | 'requests'
  | 'fees'
  | 'documents'
  | 'operations'
  | 'bi_reports'
  | 'rbac'
  | 'settings'
  | 'audit';

export interface RoleDefinition {
  code: RoleCode;
  name: string;
  description: string;
  scopeLevel: 'INSTITUTION' | 'DEPARTMENT' | 'CLASS_SUBJECT' | 'SELF';
}

export type RolePermissionMatrix = Record<RoleCode, Partial<Record<ModuleCode, PermissionAction[]>>>;

export interface Institution {
  id: string;
  name: string;
  shortCode: string;
  address: string;
  email: string;
  phone: string;
  accreditationNote: string;
  attendanceThresholdPct: number;
  passMarkPct: number;
  activeAcademicYearId: string;
  dateFormat: string;
  timezone: string;
  gradingScale: { grade: string; minPct: number; maxPct: number; points: number }[];
}

export interface Department {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  hodStaffId?: string;
  email: string;
  vision: string;
  mission: string;
  active: boolean;
  createdAt: string;
}

export interface Programme {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  category: 'UG' | 'PG' | 'PhD' | 'Diploma';
  durationYears: number;
  totalSemesters: number;
  intakeCapacity: number;
  regulationId: string;
  active: boolean;
}

export interface Regulation {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  effectiveFromYear: string;
  minAttendancePct: number;
  internalWeightagePct: number;
  externalWeightagePct: number;
  active: boolean;
}

export interface AcademicYear {
  id: string;
  institutionId: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Batch {
  id: string;
  programmeId: string;
  departmentId: string;
  label: string;
  regulationId: string;
  currentSemester: number;
  active: boolean;
}

export interface Section {
  id: string;
  batchId: string;
  departmentId: string;
  name: string;
  semester: number;
  advisorStaffId?: string;
  roomCode: string;
  strength: number;
}

export interface UserAccount {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  fullName: string;
  roles: RoleCode[];
  departmentId: string;
  staffId?: string;
  studentId?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  lastLoginAt?: string;
}

export interface SafeUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  roles: RoleCode[];
  departmentId: string;
  staffId?: string;
  studentId?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  lastLoginAt?: string;
  effectivePermissions: Partial<Record<ModuleCode, PermissionAction[]>>;
}

export interface Student {
  id: string;
  institutionId: string;
  departmentId: string;
  registerNumber: string;
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  programmeId: string;
  batchId: string;
  semester: number;
  sectionId: string;
  mentorStaffId: string;
  admissionDate: string;
  admissionCategory: 'Regular' | 'Lateral' | 'Management' | 'Scholarship';
  status: 'ACTIVE' | 'GRADUATED' | 'DISCONTINUED' | 'TRANSFERRED' | 'SUSPENDED';
  guardianName: string;
  guardianPhone: string;
  address: string;
  cgpa: number;
  documentsVerified: boolean;
  documents: { id: string; title: string; status: 'Verified' | 'Pending' | 'Rejected'; uploadedAt: string }[];
}

export interface Staff {
  id: string;
  institutionId: string;
  departmentId: string;
  staffCode: string;
  fullName: string;
  email: string;
  phone: string;
  category: 'TEACHING' | 'NON_TEACHING';
  designation: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  weeklyMaxHours: number;
  assignedRoles: RoleCode[];
  fdpCount: number;
  publicationCount: number;
}

export interface Subject {
  id: string;
  departmentId: string;
  programmeId: string;
  regulationId: string;
  code: string;
  title: string;
  category: 'CORE' | 'ELECTIVE' | 'PRACTICAL' | 'PROJECT' | 'AUDIT';
  semester: number;
  credits: number;
  weeklyHours: number;
  theoryHours: number;
  practicalHours: number;
  facultyStaffId: string;
  sectionId: string;
  courseOutcomes: string[];
  syllabusUnits: {
    unitNumber: number;
    title: string;
    totalTopics: number;
    completedTopics: number;
    targetDate: string;
  }[];
  active: boolean;
}

export interface TimetableSlot {
  id: string;
  departmentId: string;
  academicYearId: string;
  sectionId: string;
  subjectId: string;
  facultyStaffId: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
  period: number;
  startTime: string;
  endTime: string;
  roomCode: string;
  slotType: 'THEORY' | 'PRACTICAL' | 'TUTORIAL' | 'PROJECT';
  published: boolean;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'ON_DUTY';

export interface AttendanceSession {
  id: string;
  departmentId: string;
  subjectId: string;
  sectionId: string;
  facultyStaffId: string;
  date: string;
  period: number;
  topicCovered: string;
  submittedAt: string;
  submittedBy: string;
  records: {
    studentId: string;
    status: AttendanceStatus;
  }[];
}

export interface AttendanceCorrectionRequest {
  id: string;
  departmentId: string;
  sessionId: string;
  studentId: string;
  subjectId: string;
  date: string;
  currentStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  reason: string;
  requestedByUserId: string;
  requestedByName: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  reviewedByName?: string;
  reviewComment?: string;
  createdAt: string;
}

export type RequestType =
  | 'STUDENT_LEAVE'
  | 'STUDENT_OD'
  | 'STAFF_LEAVE'
  | 'BONAFIDE_CERTIFICATE'
  | 'INTERNSHIP_PERMISSION'
  | 'SECTION_CHANGE'
  | 'PROFILE_CORRECTION'
  | 'HELPDESK_TICKET';

export type WorkflowStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEED_MORE_INFO'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';

export type StaffAttendanceStatus = 'PRESENT' | 'ON_DUTY' | 'HALF_DAY' | 'ON_LEAVE' | 'ABSENT';
export type LeaveCategory = 'CL' | 'ML' | 'OD';

export interface StaffAttendanceRecord {
  id: string;
  departmentId: string;
  staffId: string;
  date: string;
  status: StaffAttendanceStatus;
  checkInTime?: string;
  remarks?: string;
  markedByName: string;
}

export interface StaffLeaveBalance {
  staffId: string;
  departmentId: string;
  academicYearId: string;
  clTotal: number;
  clUsed: number;
  mlTotal: number;
  mlUsed: number;
  odTotal: number;
  odUsed: number;
}

export interface ApprovalRequest {
  id: string;
  requestNumber: string;
  departmentId: string;
  type: RequestType;
  requesterUserId: string;
  requesterName: string;
  requesterRole: string;
  studentId?: string;
  staffId?: string;
  leaveCategory?: LeaveCategory;
  daysCount?: number;
  title: string;
  description: string;
  fromDate?: string;
  toDate?: string;
  status: WorkflowStatus;
  assignedApproverRole: RoleCode;
  createdAt: string;
  updatedAt: string;
  history: {
    timestamp: string;
    actorName: string;
    action: string;
    comment: string;
  }[];
}

export interface Assignment {
  id: string;
  departmentId: string;
  subjectId: string;
  sectionId: string;
  facultyStaffId: string;
  title: string;
  instructions: string;
  maxMarks: number;
  dueDate: string;
  attachmentName?: string;
  createdAt: string;
  submissions: {
    id: string;
    studentId: string;
    submittedAt: string;
    fileName: string;
    notes: string;
    marks?: number;
    feedback?: string;
    status: 'SUBMITTED' | 'GRADED' | 'LATE';
  }[];
}

export interface LearningMaterial {
  id: string;
  departmentId: string;
  subjectId: string;
  title: string;
  unitNumber: number;
  resourceType: 'PDF' | 'PPTX' | 'LINK' | 'LAB_MANUAL';
  uploadedByName: string;
  uploadedAt: string;
  referenceUrl: string;
}

export interface Assessment {
  id: string;
  departmentId: string;
  academicYearId: string;
  subjectId: string;
  sectionId: string;
  title: string;
  componentType: 'CIA_1' | 'CIA_2' | 'MODEL_EXAM' | 'PRACTICAL' | 'SEMINAR';
  maxMarks: number;
  passMarks: number;
  examDate: string;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'PUBLISHED';
  publishedAt?: string;
  publishedBy?: string;
  marks: {
    studentId: string;
    scoredMarks: number;
    absent?: boolean;
    remarks?: string;
  }[];
}

export interface StudentFeeLedger {
  id: string;
  departmentId: string;
  studentId: string;
  academicYearId: string;
  feeHead: string;
  totalAmount: number;
  concessionAmount: number;
  paidAmount: number;
  dueDate: string;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
  payments: {
    id: string;
    receiptNumber: string;
    transactionRef: string;
    amount: number;
    mode: 'UPI' | 'NET_BANKING' | 'CARD' | 'CHALLAN';
    paidAt: string;
  }[];
}

export interface ProjectRecord {
  id: string;
  departmentId: string;
  title: string;
  category: 'CAPSTONE' | 'MINI_PROJECT' | 'FUNDED';
  technologyStack: string;
  guideStaffId: string;
  studentIds: string[];
  milestoneProgressPct: number;
  latestReviewMarks: number;
  status: 'IN_PROGRESS' | 'REVIEW_DUE' | 'COMPLETED';
}

export interface InternshipRecord {
  id: string;
  departmentId: string;
  studentId: string;
  companyName: string;
  roleTitle: string;
  mode: 'ONSITE' | 'HYBRID' | 'REMOTE';
  startDate: string;
  endDate: string;
  stipendInr: number;
  status: 'APPROVED' | 'COMPLETED' | 'PENDING_APPROVAL';
}

export interface JobOpening {
  id: string;
  departmentId: string;
  companyName: string;
  roleTitle: string;
  packageLpa: number;
  minCgpa: number;
  driveDate: string;
  location: string;
  applicantStudentIds: string[];
  selectedStudentIds: string[];
  status: 'OPEN' | 'INTERVIEWING' | 'CLOSED';
}

export interface DepartmentEvent {
  id: string;
  departmentId: string;
  title: string;
  category: 'WORKSHOP' | 'SEMINAR' | 'FDP' | 'HACKATHON' | 'SYMPOSIUM' | 'INDUSTRIAL_VISIT';
  coordinatorStaffId: string;
  resourcePerson: string;
  eventDate: string;
  venue: string;
  budgetInr: number;
  status: 'PROPOSED' | 'APPROVED' | 'COMPLETED';
  registeredUserIds: string[];
}

export interface PublicationRecord {
  id: string;
  departmentId: string;
  title: string;
  authors: string;
  staffId: string;
  journalOrConference: string;
  indexing: 'SCOPUS' | 'SCI' | 'IEEE' | 'UGC_CARE';
  year: number;
  doi: string;
  verified: boolean;
}

export interface AccreditationEvidence {
  id: string;
  departmentId: string;
  framework: 'NAAC' | 'NBA';
  criterionCode: string;
  criterionTitle: string;
  academicYearLabel: string;
  ownerStaffId: string;
  documentTitle: string;
  completionPct: number;
  status: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'NEEDS_REVISION';
  reviewerNotes?: string;
  updatedAt: string;
}

export interface LabAsset {
  id: string;
  departmentId: string;
  labName: string;
  roomCode: string;
  inChargeStaffId: string;
  assetCode: string;
  equipmentName: string;
  quantity: number;
  warrantyUntil: string;
  condition: 'OPERATIONAL' | 'MAINTENANCE_DUE' | 'OUT_OF_ORDER';
  maintenanceTicketStatus?: 'NONE' | 'OPEN' | 'RESOLVED';
}

export interface MentorMeeting {
  id: string;
  departmentId: string;
  mentorStaffId: string;
  studentId: string;
  meetingDate: string;
  summary: string;
  actionItem: string;
  followUpStatus: 'OPEN' | 'CLOSED';
}

export interface Announcement {
  id: string;
  institutionId: string;
  departmentId: string | 'ALL';
  title: string;
  body: string;
  category: 'ACADEMIC' | 'EXAMINATION' | 'PLACEMENT' | 'EVENT' | 'GENERAL';
  targetAudience: 'ALL' | 'STUDENTS' | 'FACULTY';
  authorName: string;
  authorRole: string;
  createdAt: string;
  pinned?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorName: string;
  actorRoles: RoleCode[];
  departmentId: string;
  action: string;
  module: ModuleCode;
  entityType: string;
  entityId: string;
  summary: string;
}

export interface AcademicCalendarItem {
  id: string;
  institutionId: string;
  academicYearId: string;
  date: string;
  title: string;
  type: 'TERM_START' | 'HOLIDAY' | 'INTERNAL_EXAM' | 'UNIVERSITY_EXAM' | 'EVENT';
}

export type VaultSection = 'DOCUMENT' | 'CERTIFICATE';

export type DocumentCategory =
  | 'AADHAR'
  | 'PASSPORT'
  | 'PAN_CARD'
  | 'COMMUNITY_CERT'
  | 'INCOME_CERT'
  | 'BIRTH_CERT'
  | 'MARKSHEET_10TH'
  | 'MARKSHEET_12TH'
  | 'TRANSFER_CERT'
  | 'BONAFIDE_CERT'
  | 'DEGREE_CERT'
  | 'INTERNSHIP_CERT'
  | 'COURSE_WORKSHOP_CERT'
  | 'FDP_EXPERIENCE_CERT'
  | 'OTHER';

export interface VaultDocument {
  id: string;
  departmentId: string;
  section: VaultSection;
  ownerType: 'STUDENT' | 'STAFF';
  ownerId: string;
  ownerCode: string;
  ownerName: string;
  yearOfStudy?: number;
  category: DocumentCategory;
  title: string;
  documentNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileDataUrl?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedByName?: string;
  verifiedAt?: string;
  verificationRemarks?: string;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
}

