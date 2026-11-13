# College ERP -- Complete Single-Department Platform

## Developer-Ready Product Requirements Document (PRD)

**Document version:** 1.0\
**Date:** 13 November 2026\
**Product type:** Web-based College ERP\
**Initial deployment scope:** One college, one department\
**Future scope:** Add more departments through configuration without
redesigning the application

------------------------------------------------------------------------

## 1. Product Overview

Build a complete, role-based College ERP application that brings
together the **Student Portal, Staff/Faculty Portal, and Department/HOD
Portal** in one integrated system.

The first release will operate for **one department only**. However, the
database, permissions, APIs, and application architecture must be
designed so that the college can add additional departments later from
the Admin panel. Do not hard-code the department name, department ID,
course list, semester count, regulation, or academic year into
application logic.

The application must use one shared database and one authentication
system. Each user sees a dashboard and actions based on their assigned
role and permissions.

### Product objectives

1.  Digitize daily academic and administrative activities for the
    selected department.
2.  Give students self-service access to academic information and
    college services.
3.  Give faculty/staff tools to manage teaching, attendance,
    assessments, mentoring, and assigned duties.
4.  Give the HOD a department-wide view and approval controls.
5.  Give the College Admin/Principal centralized control over users,
    academic configuration, policies, and reports.
6.  Maintain reliable audit trails, document records, and role-based
    access.
7.  Make the platform configurable for future departments and
    programmes.

### Out of scope for the first release

-   Full multi-college SaaS tenancy.
-   Payroll and full HRMS.
-   Full accounting/ERP general ledger.
-   Hostel, transport fleet, canteen, and procurement suite unless
    explicitly added later.
-   Native Android/iOS applications (the web application must be mobile
    responsive and installable as a PWA if feasible).
-   AI-generated academic decisions. AI features must be advisory and
    introduced only after core data quality is established.

------------------------------------------------------------------------

## 2. User Roles and Access Model

Use **Role-Based Access Control (RBAC)** with permission checks on both
frontend and backend. A user may have more than one role, but access
must be scoped to the relevant department, course, class, subject, or
assigned students.

### Core roles

  -----------------------------------------------------------------------
  Role                                Purpose
  ----------------------------------- -----------------------------------
  Super Admin / System Admin          Technical configuration, user
                                      administration, system-wide
                                      settings

  College Admin                       Institution settings, academic
                                      year, department setup, policies

  Principal                           Institution-wide oversight and
                                      configured approvals

  HOD                                 Full operational management of the
                                      initially enabled department

  Assistant HOD / Department          Delegated department administration
  Coordinator                         

  Faculty / Teaching Staff            Assigned subjects, classes,
                                      attendance, marks, assignments,
                                      mentoring

  Non-Teaching Staff                  Assigned office tasks and records,
                                      with limited permissions

  Class Advisor                       Assigned class student records,
                                      attendance review, mentoring and
                                      communication

  Exam Coordinator                    Examination schedules, assessment
                                      workflows and result processing

  Placement Coordinator               Placement drives, internships and
                                      career activities

  IQAC / Accreditation Coordinator    Evidence collection and
                                      accreditation documentation

  Lab In-Charge                       Lab schedules, assets and
                                      maintenance requests

  Student                             Own profile, attendance, learning,
                                      fees status, exams, requests and
                                      activities

  Parent / Guardian (optional phase)  Verified and authorized view of
                                      linked student information
  -----------------------------------------------------------------------

### Permission model

Each permission must support the following actions where applicable:

-   `view`
-   `create`
-   `edit`
-   `delete`
-   `submit`
-   `approve`
-   `reject`
-   `publish`
-   `export`
-   `verify`
-   `assign`

Permissions must be configurable by an authorized administrator.
Sensitive actions (marks publication, attendance correction, fee
adjustments, role changes, student status changes) must require explicit
permission and create audit records.

### Scope rules

-   Student: own record only.
-   Faculty: assigned subjects, sections, students, and tasks only.
-   Class Advisor: assigned class/section only.
-   HOD: all records within the assigned department.
-   Principal/College Admin: institution-level access according to
    permission.
-   Non-teaching staff: only assigned operational records.
-   Parent: only verified linked student records and only fields
    approved by the institution.

Never rely on hiding a menu item as the only security control. Every API
endpoint must independently validate the user's identity, role,
permission, and data scope.

------------------------------------------------------------------------

## 3. Application Navigation and Portal Structure

Use a shared application shell with role-specific navigation.

### 3.1 Student Portal

1.  Dashboard
2.  My Profile
3.  Academics
4.  Attendance
5.  Timetable
6.  Assignments & Learning Materials
7.  Internal Assessments
8.  Examinations & Results
9.  Fees & Payment History
10. Library (if enabled)
11. Projects & Internship
12. Placement & Career
13. Events & Workshops
14. Certificates & Student Requests
15. Leave / OD Requests
16. Mentoring & Student Support
17. Announcements & Messages
18. Feedback & Surveys
19. Documents
20. Settings & Helpdesk

### 3.2 Faculty / Staff Portal

1.  Dashboard
2.  My Profile
3.  My Timetable
4.  My Subjects & Classes
5.  Student Lists
6.  Attendance Entry
7.  Attendance Correction Requests
8.  Lesson Plans
9.  Syllabus Progress
10. Learning Materials
11. Assignments & Submissions
12. Internal Assessment Marks
13. Exam Duties (if assigned)
14. Student Mentoring
15. Leave Requests
16. OD / Duty Requests
17. Events & Workshops
18. Projects & Project Guidance
19. Research & Publications
20. Faculty Development / Certifications
21. Department Notices
22. Tasks & Approvals
23. Reports (permission-based)
24. Settings & Helpdesk

Non-teaching staff must see a smaller configurable menu based on their
assigned responsibilities.

### 3.3 HOD / Department Portal

1.  Department Dashboard
2.  Department Profile
3.  Programmes & Courses
4.  Academic Year / Semester Setup
5.  Student Management
6.  Faculty & Staff Management
7.  Subject & Curriculum Management
8.  Faculty / Class / Lab Timetable
9.  Student Attendance Monitoring
10. Faculty Workload
11. Lesson Plan & Syllabus Monitoring
12. Assignments & Internal Assessment Monitoring
13. Examination & Result Analysis
14. Student Mentoring
15. Projects & Internship
16. Placement & Career Activities
17. Events, Seminars, Workshops and FDP
18. Research & Publications
19. Laboratory & Assets
20. Accreditation / IQAC Evidence
21. Department Budget & Purchase Requests (optional)
22. Announcements & Communication
23. Approval Centre
24. Reports & Analytics
25. Department Settings
26. Audit / Activity History (permission-based)

### 3.4 College Admin / Principal Portal

For the first release, provide institution-level settings needed to
operate one department:

-   College profile and branding.
-   Academic year and term settings.
-   Department activation and configuration.
-   User and role administration.
-   Academic policies and grading configuration.
-   Global notification templates.
-   Approval workflow configuration.
-   Data import/export.
-   Integration settings.
-   System audit logs.
-   Backup and operational settings.

The College Admin must be able to create a second department later
without code changes.

------------------------------------------------------------------------

## 4. Core Functional Requirements

## 4.1 Authentication and User Management

**Requirements**

-   Secure login using institutional email/username and password.
-   Password reset flow using verified email or OTP integration.
-   Optional MFA / two-factor authentication.
-   Session expiry and logout.
-   Login history and active session management.
-   User activation, suspension, and deactivation.
-   User-role assignment and revocation.
-   Bulk user import with validation and error report.
-   First-login password change where configured.
-   Account linking for faculty who hold multiple roles.

**Acceptance criteria**

-   A user cannot access a portal or record outside their permissions.
-   Deactivated users cannot start new sessions.
-   Passwords are securely hashed; never stored in plain text.
-   Login, logout, password reset, and role changes are logged.

## 4.2 Student Profile Management

**Student data fields**

-   Student ID (internal primary key).
-   Register number / admission number (unique within configured scope).
-   Full name and profile photo.
-   Date of birth (restricted access).
-   Contact email and phone.
-   Parent/guardian contact details.
-   Address.
-   Admission date and admission category.
-   Programme, batch, semester, section.
-   Academic status: active, graduated, discontinued, transferred,
    suspended (configurable).
-   Previous education details.
-   Uploaded documents and verification status.
-   Emergency contact.
-   Scholarship/concession information (restricted).
-   Optional fields configurable by institution.

**Student actions**

-   View profile.
-   Request correction to protected fields.
-   Upload permitted documents.
-   View document verification status.
-   Download digital ID card if enabled.
-   View academic history.

**Admin/HOD actions**

-   Create/edit student records according to permissions.
-   Approve profile correction requests.
-   Promote students to next semester/year.
-   Transfer section or batch with history.
-   Mark graduation/discontinuation/transfer.
-   Import students through CSV/XLSX template.

Do not allow students to directly edit protected academic identifiers or
official status fields.

## 4.3 Faculty and Staff Management

**Staff profile fields**

-   Staff ID (unique).
-   Name, photo, institutional email and phone.
-   Staff category: teaching / non-teaching.
-   Designation and employment status.
-   Qualification and specialization.
-   Joining date.
-   Department assignment.
-   Assigned role(s).
-   Subjects, classes, and sections assigned.
-   Mentor allocation.
-   Certifications, FDP and professional development records.
-   Publications and research interests (where relevant).
-   Uploaded employment/qualification documents with restricted access.

**Functions**

-   Create and maintain staff profiles.
-   Assign staff to subjects, classes, and sections.
-   Assign Class Advisor, Mentor, Lab In-Charge, Exam Coordinator,
    Placement Coordinator, and IQAC Coordinator duties.
-   View faculty workload.
-   Manage faculty leave and duty requests.
-   Maintain staff activity and development records.
-   Track assignment history and staff status.

## 4.4 Department, Programme, Course, Batch and Section Setup

Although only one department is active initially, use normalized and
configurable records.

**Hierarchy**

College → Department → Programme → Regulation → Academic Year → Batch →
Semester → Section → Subject.

**Department fields**

-   Department code and name.
-   Description.
-   HOD assignment.
-   Contact details.
-   Vision, mission, objectives.
-   Logo/image (optional).
-   Active/inactive status.

**Programme fields**

-   Programme code and name.
-   UG / PG / Diploma / PhD / other configurable category.
-   Duration.
-   Semester/year structure.
-   Admission capacity.
-   Eligibility criteria.
-   Regulation mapping.
-   Credit structure.
-   Active status.

**Configuration rules**

-   Semester count must be configurable; do not assume all programmes
    have six semesters.
-   Regulations must be versioned and mapped to applicable batches.
-   Subject mapping must be specific to programme, regulation, semester
    and applicable section.
-   Historical academic records must remain accessible after a
    regulation changes.
-   Do not delete academic master records that are already referenced by
    student records; use inactive/archive status.

## 4.5 Subject and Curriculum Management

-   Subject code and title.
-   Subject category: core, elective, practical, project, audit,
    value-added, or configurable.
-   Programme, regulation and semester mapping.
-   Credits and teaching hours.
-   Theory/practical split.
-   Assigned faculty.
-   Syllabus units and topics.
-   Course Outcomes (COs).
-   Programme Outcomes (POs) and PSOs mapping where configured.
-   Assessment components and weightages.
-   Prerequisite subjects where applicable.
-   Curriculum version and effective batch.

HOD/authorized staff can create and map subjects. Faculty can view only
subjects assigned to them unless granted broader access.

## 4.6 Academic Calendar and Timetable

**Academic calendar**

-   Semester start/end dates.
-   Working days.
-   Holidays.
-   Internal assessment dates.
-   University examination dates.
-   Events, workshops and deadlines.
-   Registration and fee deadlines.

**Timetable**

-   Day and period.
-   Start/end time.
-   Programme, semester, section.
-   Subject and faculty.
-   Room/lab.
-   Period type: theory, practical, tutorial, project, activity.
-   Substitution / special class.

**Validation**

-   Detect faculty clashes.
-   Detect room/lab clashes.
-   Detect section timetable clashes.
-   Validate room capacity where capacity data exists.
-   Keep a version history.
-   Publish timetable to student and faculty portals only after
    authorized approval.

Manual timetable creation is required for MVP. Automated timetable
generation may be a later enhancement.

## 4.7 Attendance Management

**Faculty workflow**

1.  Faculty opens an assigned class/subject and date.
2.  System loads the approved student list.
3.  Faculty marks present, absent, on-duty, or other
    institution-configured status.
4.  Faculty saves/submits attendance.
5.  System records who submitted it and when.
6.  Corrections after submission follow an approval workflow.

**Student functions**

-   View daily and subject-wise attendance.
-   View monthly and semester summaries.
-   View attendance shortage alerts.
-   Submit leave/OD requests.
-   Request correction with reason and evidence.

**HOD functions**

-   View subject-wise, class-wise, batch-wise and student-wise
    attendance.
-   Review correction requests.
-   Identify attendance shortages.
-   Export attendance reports.

**Rules**

-   Attendance threshold must be configurable by regulation/programme
    and institution policy.
-   Do not hard-code a universal minimum percentage.
-   Keep the original attendance entry and every correction in an audit
    history.
-   Prevent duplicate attendance for the same student, subject, session
    and date unless an authorized correction process is used.
-   Handle holidays, cancelled classes and timetable changes.
-   Show calculation rules transparently.

## 4.8 Leave, OD and Student Requests

Support configurable request types:

-   Student leave.
-   Student on-duty (OD).
-   Attendance correction.
-   Bonafide certificate.
-   ID card replacement.
-   Course/subject change request.
-   Section change request.
-   Internship permission.
-   Project topic approval.
-   General grievance/helpdesk ticket.

Each request must have:

-   Request number.
-   Request type.
-   Requester and relevant student/staff ID.
-   Submission date.
-   From/to date if applicable.
-   Reason and attachments.
-   Current status.
-   Assigned approver.
-   Approval/rejection comments.
-   Complete status history.

Statuses: Draft, Submitted, Under Review, Need More Information,
Approved, Rejected, Cancelled, Completed.

Approval routes must be configurable by request type and institution
policy.

## 4.9 Assignments and Learning Materials

**Faculty**

-   Create assignment for an assigned subject/class.
-   Add title, instructions, marks, due date and allowed file types.
-   Attach learning materials (PDF, DOCX, PPTX, images, links, video
    links).
-   View submissions.
-   Mark, comment and return submissions.
-   Permit resubmission where configured.

**Student**

-   View assignments and due dates.
-   Upload submission.
-   View submission timestamp and status.
-   View marks and faculty feedback after release.

**System**

-   File size/type validation.
-   Submission history.
-   Deadline status.
-   Late submission rules.
-   Secure file access.
-   Notifications for new assignments and deadlines.

## 4.10 Internal Assessment and Examination

-   Assessment component configuration.
-   Internal test schedules.
-   Assignment/seminar/practical marks.
-   Marks entry by authorized faculty.
-   Validation of maximum marks and weightage.
-   Draft and submit workflow.
-   HOD/Exam Coordinator verification.
-   Result approval and publication.
-   Student result view.
-   Revaluation / correction request if enabled.
-   Arrear/backlog records where applicable.
-   Grade and CGPA/SGPA calculation based on configured regulation.

**Critical rules**

-   Never hard-code grading scales, pass marks, internal/external
    weightages, or CGPA formulas.
-   Store raw marks and calculated grades separately.
-   Maintain result versions and a full audit trail.
-   Students must not see unpublished marks.
-   Published results must only be changed through an authorized
    correction workflow.

## 4.11 Fees and Payment Records

For MVP, support fee visibility and payment records. Actual payment
gateway integration can be enabled after merchant account configuration.

-   Fee heads and fee schedules.
-   Student-specific fee assignment.
-   Amount due, paid and balance.
-   Due dates and instalments.
-   Scholarship/concession records with restricted access.
-   Payment transaction reference.
-   Receipt number and downloadable receipt.
-   Refund/adjustment request workflow.
-   Payment status reconciliation.

Do not store card numbers, CVV, UPI PIN, or banking credentials. Use a
compliant payment gateway and store only its transaction references and
required response metadata.

## 4.12 Projects, Internship and Placement

**Projects**

-   Project title and abstract.
-   Student/team members.
-   Internal guide.
-   Project category and technology.
-   Review milestones.
-   Progress reports.
-   Uploaded files and links.
-   Review marks and feedback.
-   Final completion status.

**Internships**

-   Company and role.
-   Internship dates.
-   Mode and location.
-   Permission/approval.
-   Attendance or progress evidence where required.
-   Completion report.
-   Certificate verification.

**Placement**

-   Company profiles.
-   Job/internship openings.
-   Eligibility rules.
-   Student applications.
-   Aptitude/interview rounds.
-   Application status.
-   Offer and placement details with restricted access.
-   Placement reports.

Do not expose salary or offer details to unauthorized users.

## 4.13 Events, Workshops and Faculty Development

-   Event proposal.
-   Event category.
-   Title, objective and description.
-   Organizer and coordinator.
-   Resource person details.
-   Date, time and venue.
-   Budget request (if enabled).
-   Approval status.
-   Student/staff registration.
-   Attendance/participation.
-   Feedback.
-   Certificate issue record.
-   Event report and evidence attachments.

Support seminars, guest lectures, workshops, symposiums, FDPs,
value-added courses, industrial visits, webinars, hackathons and
competitions.

## 4.14 Research, Publications and Accreditation

**Research records**

-   Research projects and funding.
-   Publications and conference papers.
-   DOI, ISBN and indexing information.
-   Patents/copyrights.
-   Consultancy and collaborations.
-   Faculty/student participation.
-   Evidence attachments and verification.

**Accreditation / IQAC evidence**

-   Configurable criteria and sub-criteria.
-   Academic-year tagging.
-   Evidence owner.
-   Upload and document metadata.
-   Verification status.
-   Reviewer comments.
-   Version history.
-   Completion dashboard.
-   Exportable evidence index and reports.

Do not present the system as automatically certifying NAAC/NBA
compliance. It is a documentation and tracking tool; institution
coordinators must validate applicable frameworks and current criteria.

## 4.15 Mentoring and Student Support

-   Mentor-to-student allocation.
-   Mentor meeting date and outcome.
-   Academic progress notes.
-   Follow-up actions.
-   Parent meeting records where authorized.
-   Support/counselling appointment request.
-   Referral and follow-up status.

Counselling and sensitive personal notes must use separate restricted
permissions. Do not expose sensitive notes to general faculty or
student-facing reports.

## 4.16 Laboratory and Assets

-   Lab and room master.
-   Lab in-charge.
-   Equipment and asset ID.
-   Purchase date and supplier (if available).
-   Warranty/AMC dates.
-   Asset condition and location.
-   Maintenance request and status.
-   Lab timetable and utilization.
-   Software license details.

## 4.17 Announcements, Notifications and Communication

-   Institution announcements.
-   Department announcements.
-   Programme/class-specific announcements.
-   Individual notifications.
-   Email and SMS integration (provider credentials configured by
    Admin).
-   In-app notification centre.
-   Push notifications if PWA support is implemented.
-   Read/unread state.
-   Notification delivery logs.

WhatsApp notifications must use an approved provider and applicable
consent. Do not assume personal WhatsApp automation is available.

## 4.18 Reports and Analytics

**Student reports**

-   Student profile and strength.
-   Attendance.
-   Internal marks and results.
-   Fee dues.
-   Assignment status.
-   Student progression.
-   Internship and placement.

**Faculty reports**

-   Faculty workload.
-   Attendance submission status.
-   Lesson plan completion.
-   Syllabus completion.
-   Assessment completion.
-   Mentoring activity.
-   FDP and research activity.

**Department reports**

-   Student strength by programme/batch/section.
-   Attendance trends.
-   Result and pass percentage.
-   Subject performance.
-   Faculty workload.
-   Syllabus completion.
-   Event participation.
-   Research output.
-   Placement statistics.
-   Accreditation evidence status.

All reports must support date, academic year, programme, semester,
batch, section and subject filters as appropriate. Export to
PDF/Excel/CSV based on permission.

------------------------------------------------------------------------

## 5. Dashboard Requirements

### Student dashboard

Display:

-   Student identity and academic programme.
-   Current semester and section.
-   Attendance percentage and shortage alerts.
-   Today's timetable.
-   Upcoming assignments.
-   Internal assessment status.
-   Published results and CGPA/SGPA.
-   Fee balance and due dates.
-   Announcements.
-   Pending requests.
-   Upcoming events and placement opportunities.

### Faculty dashboard

Display:

-   Today's timetable.
-   Assigned subjects and classes.
-   Attendance entry shortcuts.
-   Pending attendance submissions.
-   Assignment submissions awaiting evaluation.
-   Marks submission deadlines.
-   Lesson plan and syllabus progress.
-   Mentoring tasks.
-   Leave/request status.
-   Department announcements.

### HOD dashboard

Display:

-   Total students and staff.
-   Programme/batch/section strength.
-   Attendance overview and shortage list.
-   Faculty workload.
-   Timetable and syllabus completion.
-   Assessment/marks submission status.
-   Pending approvals.
-   Student requests and grievances.
-   Event and research activities.
-   Placement and internship overview.
-   Accreditation evidence progress.

### Admin dashboard

Display:

-   User count by role.
-   Active academic year.
-   Configured department(s).
-   User import and onboarding status.
-   Pending institution-level approvals.
-   System alerts and integration health.
-   Recent administrative activity.

All dashboard figures must be calculated from actual records and must
respect access scope. Do not display sample figures in production.

------------------------------------------------------------------------

## 6. Advanced Configuration and Settings

Build a central Settings area with the following sections:

### Institution settings

-   College name, logo, address, contact information.
-   Academic calendar.
-   Time zone and date format.
-   Working days and holidays.
-   Email/SMS provider configuration.
-   Branding and theme.

### Department settings

-   Department code/name.
-   HOD and coordinators.
-   Programmes and courses.
-   Department-specific custom fields.
-   Department-specific announcement categories.
-   Active/inactive state.

### Academic settings

-   Academic years and terms.
-   Regulations and effective batches.
-   Semester/year structure.
-   Grading schemes.
-   Attendance rules.
-   Assessment components.
-   Promotion rules.
-   Result publication policy.

### Workflow settings

-   Request types.
-   Approval stages.
-   Approver role/user.
-   Escalation rules.
-   Notification triggers.
-   Delegation rules.

### Security settings

-   Password policy.
-   MFA setting.
-   Session timeout.
-   Allowed file types and sizes.
-   Role and permission management.
-   Login history.
-   Audit log retention policy.

### User experience settings

-   Light/dark/system theme.
-   Responsive layouts.
-   Supported languages.
-   Notification preferences.
-   Accessibility options.

------------------------------------------------------------------------

## 7. Data Model and Database Design

Use a relational database such as PostgreSQL. Use UUID primary keys (or
another consistent non-guessable identifier strategy) and foreign keys.
Define unique constraints, indexes, and deletion rules deliberately.

### Core tables

  Table                    Purpose
  ------------------------ ------------------------------------------------
  institutions             College/institution master
  departments              Department master; initially one active record
  users                    Authentication identity
  roles                    Role master
  permissions              Permission master
  user_roles               User-role mapping
  role_permissions         Role-permission mapping
  user_sessions            Session tracking
  students                 Student profile
  staff                    Faculty/non-teaching staff profile
  guardians                Parent/guardian details
  student_guardians        Verified student-guardian mapping
  programmes               UG/PG/other programmes
  regulations              Academic regulations
  academic_years           Academic year master
  batches                  Admission batches
  semesters                Programme semester/term master
  sections                 Class sections
  enrollments              Student programme/batch/section mapping
  subjects                 Subject master
  curriculum_subjects      Regulation/semester/subject mapping
  faculty_subjects         Faculty-subject-class mapping
  class_advisors           Advisor assignments
  mentor_assignments       Mentor-student mapping
  academic_calendar        Academic events and holidays
  timetable_slots          Timetable entries
  attendance_sessions      Scheduled class sessions
  attendance_records       Student attendance entries
  attendance_corrections   Correction requests and history
  leave_requests           Student/staff leave
  od_requests              On-duty requests
  lesson_plans             Faculty lesson plans
  syllabus_topics          Unit/topic structure
  syllabus_progress        Topic completion
  assignments              Assignment master
  assignment_submissions   Student submissions
  assessments              Assessment components
  marks                    Student assessment marks
  examinations             Exam schedule/master
  results                  Published results and grades
  fee_heads                Fee categories
  student_fees             Student fee assignments
  payments                 Payment transactions
  receipts                 Receipt records
  projects                 Student projects
  project_members          Project team members
  project_reviews          Project review records
  internships              Internship records
  companies                Company master
  job_openings             Placement opportunities
  job_applications         Student applications
  events                   Department events
  event_registrations      Event participants
  event_attendance         Event attendance
  certificates             Certificate requests/issues
  publications             Research publications
  research_projects        Research project records
  accreditation_criteria   Configurable criteria
  accreditation_evidence   Uploaded evidence
  laboratories             Lab master
  assets                   Lab/department assets
  maintenance_requests     Maintenance tickets
  announcements            Notice master
  notifications            User notifications
  helpdesk_tickets         Support/grievance tickets
  approval_workflows       Workflow definitions
  approval_requests        Individual approval transactions
  approval_history         Approval action history
  documents                File metadata and ownership
  audit_logs               Sensitive action history

### Data modelling rules

1.  Include `institution_id` on institution-owned records where
    appropriate.
2.  Include `department_id` on department-scoped records.
3.  Use foreign keys rather than storing related names as free text.
4.  Use effective dates for assignments and academic mappings where
    historical tracking is needed.
5.  Use status fields and archival instead of hard deletion for academic
    records.
6.  Add `created_at`, `updated_at`, `created_by`, and `updated_by` to
    important business tables.
7.  Store uploaded file metadata in the database and file bytes in
    private object storage.
8.  Use database transactions for marks publication, fee transactions,
    promotion, and other multi-record operations.
9.  Define unique constraints to prevent duplicate register numbers,
    attendance records, subject mappings and payment references within
    their correct scope.
10. Create indexes for common filters such as academic year, programme,
    semester, batch, section, student, subject and status.

### Future multi-department requirement

The initial deployment has one department, but the schema must support
many departments. When a second department is added:

-   Admin creates a department record.
-   Assigns HOD and staff.
-   Creates or maps programmes and courses.
-   Configures academic year, regulations, semesters and subjects.
-   Imports or admits students.
-   Assigns faculty and coordinators.
-   Sets department-specific permissions.

The existing application should continue working without a schema
redesign or a separate application instance.

------------------------------------------------------------------------

## 8. API Design Guidelines

Use REST APIs with a consistent response format and API versioning, for
example `/api/v1/...`.

### Suggested API groups

  -----------------------------------------------------------------------
  API group                           Example endpoints
  ----------------------------------- -----------------------------------
  Authentication                      `/auth/login`, `/auth/logout`,
                                      `/auth/refresh`,
                                      `/auth/forgot-password`

  Users                               `/users`, `/users/:id`,
                                      `/users/:id/roles`

  Departments                         `/departments`, `/departments/:id`

  Programmes                          `/programmes`, `/programmes/:id`

  Students                            `/students`, `/students/:id`,
                                      `/students/import`

  Staff                               `/staff`, `/staff/:id`

  Subjects                            `/subjects`, `/curriculum`

  Timetable                           `/timetable`, `/timetable/publish`

  Attendance                          `/attendance/sessions`,
                                      `/attendance/records`,
                                      `/attendance/corrections`

  Assignments                         `/assignments`,
                                      `/assignments/:id/submissions`

  Assessments                         `/assessments`, `/marks`,
                                      `/results/publish`

  Fees                                `/fees`, `/payments`, `/receipts`

  Requests                            `/requests`,
                                      `/requests/:id/approve`

  Events                              `/events`,
                                      `/events/:id/registrations`

  Projects                            `/projects`,
                                      `/projects/:id/reviews`

  Placements                          `/companies`, `/openings`,
                                      `/applications`

  Reports                             `/reports/attendance`,
                                      `/reports/results`,
                                      `/reports/workload`

  Settings                            `/settings/academic`,
                                      `/settings/workflows`

  Audit                               `/audit-logs`
  -----------------------------------------------------------------------

API implementation requirements:

-   Validate all inputs server-side.
-   Apply authentication and permission middleware.
-   Enforce data scope on every read and write.
-   Use pagination, sorting and filtering for lists.
-   Use consistent error codes and messages.
-   Rate-limit authentication and sensitive endpoints.
-   Document APIs with OpenAPI/Swagger.
-   Do not expose internal database errors or secrets.

------------------------------------------------------------------------

## 9. Recommended Technology Stack

The development team may propose alternatives, but should retain the
architecture and requirements below.

  -----------------------------------------------------------------------
  Layer                               Recommended option
  ----------------------------------- -----------------------------------
  Frontend                            React.js or Next.js with TypeScript

  UI                                  Tailwind CSS with accessible
                                      component library

  Backend                             Node.js with NestJS or Express

  Database                            PostgreSQL

  ORM                                 Prisma or TypeORM

  Authentication                      Secure server-managed sessions or
                                      short-lived JWT + refresh strategy

  File storage                        Private AWS S3-compatible object
                                      storage

  Background jobs                     Redis-backed queue if needed

  Notifications                       Email/SMS provider; Firebase Cloud
                                      Messaging for web push if
                                      implemented

  Payments                            Razorpay/Cashfree integration after
                                      merchant setup

  API documentation                   OpenAPI / Swagger

  Deployment                          Cloud hosting with staging and
                                      production environments

  Monitoring                          Centralized application logs and
                                      error monitoring

  Reporting                           Server-side reports and export
                                      service
  -----------------------------------------------------------------------

The team must justify any stack changes before implementation.

------------------------------------------------------------------------

## 10. Security, Privacy and Compliance Requirements

-   HTTPS for all environments outside local development.
-   Secure password hashing using a modern password-hashing algorithm.
-   Secure cookies and CSRF protection where cookie-based sessions are
    used.
-   Protection against SQL injection, XSS, CSRF, IDOR and file upload
    attacks.
-   Server-side RBAC and department-level data scoping.
-   Private document storage with time-limited signed download links.
-   File type, file size and malware scanning controls where available.
-   Encryption in transit and appropriate encryption at rest.
-   Audit logs for marks, attendance, fees, approvals, user roles and
    student status.
-   Automated backups and tested restore procedure.
-   Secrets stored in environment/secret management, never in source
    code.
-   No production personal data in development/test environments unless
    safely masked.
-   Retention and deletion policy for personal data.
-   Consent and privacy notices where required.
-   Restrict access to date of birth, contact details, guardian data,
    counselling records, fee concessions and placement offers.
-   Review applicable Indian data protection, education and
    institutional requirements before production launch.

------------------------------------------------------------------------

## 11. User Interface and Experience Requirements

-   Responsive desktop, tablet and mobile layouts.
-   Role-specific dashboards and navigation.
-   Consistent page layout, typography and form patterns.
-   Search, filter, sort and pagination on data-heavy pages.
-   Clear loading, empty, success and error states.
-   Confirmation for destructive or high-impact actions.
-   Accessible labels, keyboard navigation and sufficient contrast.
-   Dashboard cards must link to relevant detailed records.
-   Provide breadcrumbs for nested administration pages.
-   Support CSV/XLSX bulk import with preview, validation and
    downloadable error report.
-   Provide PDF/Excel exports where permission allows.
-   Keep forms usable on mobile devices.
-   Use institution branding configurable by Admin.

### Main application layout

-   Left sidebar: role-specific modules.
-   Top bar: institution/department context, academic year selector,
    notifications, profile menu.
-   Main content: dashboard, tables, forms and reports.
-   Global search: only search records the user is authorized to see.

------------------------------------------------------------------------

## 12. Non-Functional Requirements

  -----------------------------------------------------------------------
  Area                                Requirement
  ----------------------------------- -----------------------------------
  Performance                         Common list and dashboard requests
                                      should normally load within 2--3
                                      seconds under agreed test load

  Scalability                         Add departments, programmes,
                                      batches and users through
                                      configuration

  Availability                        Define uptime target with the
                                      institution and hosting provider

  Reliability                         Transactions and validation for
                                      critical academic/financial
                                      operations

  Security                            RBAC, scoped data access, secure
                                      file handling and audit logs

  Maintainability                     Modular codebase, typed interfaces
                                      and documented APIs

  Accessibility                       Follow WCAG 2.1 AA as a target
                                      where practical

  Backup                              Automated backup schedule and
                                      tested recovery process

  Browser support                     Current major Chrome, Edge, Firefox
                                      and Safari versions

  Localization                        Store dates/times consistently;
                                      display institution-configured
                                      formats

  Observability                       Central logs, error tracking and
                                      health checks
  -----------------------------------------------------------------------

The team must document expected user volume and test with realistic data
before go-live.

------------------------------------------------------------------------

## 13. MVP Development Plan

Build and release in controlled phases. Do not attempt all advanced
modules in the first sprint.

### Phase 1 -- Foundation

-   Project setup and environments.
-   Database and authentication.
-   RBAC and user management.
-   Institution and single department setup.
-   Programme, academic year, batch, semester, section setup.
-   Student and staff profiles.
-   Audit logging foundation.

**Milestone:** Admin can configure one department and create
student/staff accounts.

### Phase 2 -- Core Academics

-   Subject and curriculum mapping.
-   Faculty-subject assignment.
-   Timetable.
-   Attendance.
-   Student leave/OD requests.
-   Faculty dashboard.
-   Student dashboard.

**Milestone:** Faculty can mark attendance and students can view their
own records.

### Phase 3 -- Teaching and Assessment

-   Lesson plans.
-   Syllabus progress.
-   Learning materials.
-   Assignments and submissions.
-   Internal assessments and marks.
-   Examination schedule.
-   Result calculation and controlled publication.

**Milestone:** Complete one semester's teaching and internal assessment
workflow.

### Phase 4 -- Department Operations

-   HOD dashboard.
-   Approval centre.
-   Faculty workload.
-   Mentoring.
-   Events and workshops.
-   Projects and internships.
-   Announcements and notifications.
-   Reports and exports.

**Milestone:** HOD can monitor and approve the department's operational
activities.

### Phase 5 -- Extended Services

-   Fee records and payment gateway.
-   Certificates.
-   Placement.
-   Research and publications.
-   Accreditation evidence.
-   Laboratory and asset management.
-   Parent portal if approved.

**Milestone:** Extended department services are operational.

### Phase 6 -- Scale and Intelligence

-   Add second department through Admin configuration.
-   Validate cross-department data isolation.
-   Advanced analytics.
-   Optional AI assistant and early-warning recommendations.
-   Performance and security testing.

**Milestone:** The same deployment supports multiple departments without
application redesign.

------------------------------------------------------------------------

## 14. Testing and Acceptance Criteria

The application is not complete until the following scenarios pass.

### Authentication and permissions

-   Student A cannot view Student B's private records by changing a URL
    or API ID.
-   Faculty can access only assigned classes/subjects unless separately
    authorized.
-   HOD can access the assigned department.
-   College Admin can configure institution-level settings.
-   Revoked permissions take effect on subsequent requests.
-   Deactivated users cannot log in.

### Academic workflows

-   Admin creates an academic year, programme, batch, semester and
    section.
-   Admin maps subjects to the correct regulation and semester.
-   Faculty sees the correct timetable and class list.
-   Faculty marks attendance.
-   Student sees updated attendance.
-   Attendance correction requires the configured approval.
-   Faculty enters marks within configured limits.
-   Unpublished marks remain hidden from students.
-   Authorized user publishes results and the action is audited.

### Department workflows

-   HOD sees department-wide data and pending approvals.
-   HOD assigns faculty to subjects and classes.
-   HOD monitors lesson plan and syllabus progress.
-   Faculty submits event proposal and follows configured approvals.
-   Evidence is uploaded and verified by authorized accreditation staff.
-   Reports match the underlying records.

### Future department expansion

-   Admin creates a second department without code changes.
-   Second department can have its own HOD, programmes, subjects,
    faculty and students.
-   First department's users cannot access the second department's
    restricted data.
-   Institution-level reports can consolidate both departments for
    authorized users.

### Data and operational safety

-   Bulk import identifies duplicate and invalid rows.
-   Critical changes appear in audit logs.
-   Backup can be restored in a test environment.
-   File links cannot be accessed by unauthorized users.
-   Payment callback handling is idempotent if gateway integration is
    enabled.

------------------------------------------------------------------------

## 15. Developer Deliverables

The development team must provide:

1.  Approved requirement and scope document.
2.  User flow diagrams for each role.
3.  Wireframes for Student, Faculty, HOD and Admin portals.
4.  ER diagram and database schema.
5.  API specification (OpenAPI/Swagger).
6.  Frontend and backend source code.
7.  Database migrations and seed data.
8.  Role-permission matrix.
9.  Automated tests for critical workflows.
10. Deployment configuration and environment variable guide.
11. Admin user manual.
12. Student and faculty user guides.
13. Backup and restore documentation.
14. Security and deployment checklist.
15. Handover documentation and source repository access.

------------------------------------------------------------------------

## 16. Development Rules -- Must Follow

1.  Build one integrated application, not three disconnected
    applications.
2.  Use one authentication system and shared database.
3.  Display different dashboards and menus based on role and permission.
4.  Build for one active department in the initial release, but make
    department count configurable.
5.  Never hard-code a department name, course, regulation, semester
    count, grading rule or attendance threshold.
6.  Keep institution, department, programme, batch, semester, section
    and subject relationships clear.
7.  Every sensitive action must be permission-checked on the backend and
    audited.
8.  Use configurable approval workflows.
9.  Preserve historical academic records when students are promoted,
    transferred or regulations change.
10. Build reusable modules and components.
11. Use realistic sample data only in development; never show fake
    metrics in production.
12. Do not mark a module complete until its workflows, permissions,
    validation, error handling and tests are implemented.
13. Obtain institution approval for policies, grading, attendance,
    privacy and retention rules before production use.
14. Deliver working features incrementally and demonstrate each
    milestone.

------------------------------------------------------------------------

## 17. Final Product Definition

**Product name:** College ERP -- Department Edition

**Initial release:** A complete integrated ERP for one college
department with Student, Faculty/Staff, HOD and College Admin portals.

**Future expansion:** Additional departments can be created by the
College Admin using the same application, database and permission
architecture.

**Core success outcome:** Students manage their academic journey,
faculty manage teaching and student activities, HOD manages the
department, and College Admin controls the institution---all through one
secure, configurable and auditable platform.

### Instruction to the development team

Before coding, review this PRD and submit: - System architecture
diagram. - Role-permission matrix. - Database ER diagram. - Page-by-page
screen list. - API plan. - Sprint-wise implementation estimate. - List
of assumptions and questions requiring college confirmation.

Begin implementation only after the institution approves the workflows,
academic rules, grading configuration, attendance policy and initial
department setup.
