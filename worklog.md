# Aura Academy Worklog

---
Task ID: 1
Agent: Main
Task: Add StudentEnrollment model to Prisma schema

Work Log:
- Added StudentEnrollment model with relations to Student, Service, Subject, Level, Teacher
- Added enrollmentId to Payment model
- Added reverse relations to Student, Service, Subject, Level, Teacher models
- Changed local datasource to SQLite for development
- Pushed schema to database successfully

Stage Summary:
- New table: StudentEnrollment (studentId, serviceId, subjectId, levelId, teacherId, monthlyFee, status)
- Payment now has optional enrollmentId field
- Backward compatible: existing students/payments work without enrollments

---
Task ID: 2
Agent: fullstack-dev
Task: Update payment API routes for per-enrollment payments

Work Log:
- Extracted shared `paymentInclude` constant with enrollment + nested student relations (satisfies Prisma.PaymentInclude)
- GET /api/payments: added `enrollmentId` optional query param for filtering
- GET /api/payments: added enrollment include (service, subject, teacher) to response
- POST /api/payments: added `enrollmentId` optional field for single payment mode
- POST /api/payments: added batch `enrollmentPayments` array mode using db.$transaction
  - Auto-calculates remainingAmount = amount - discount - paidAmount
  - Auto-determines status: paid / partial / pending
  - Returns array of created payments
- GET /api/payments/[id]: added enrollment include to response
- PUT /api/payments/[id]: accepts `enrollmentId` update (only applied when explicitly provided)
- PUT /api/payments/[id]: added enrollment include to response
- Verified: no new TypeScript errors introduced

Stage Summary:
- Both payment route files fully support the new StudentEnrollment relation
- Backward compatible: existing single-payment flows unaffected
- New batch payment endpoint enables per-enrollment payments in a single transaction

---
Task ID: 2
Agent: Fullstack Dev
Task: Create enrollment API routes

Work Log:
- Created GET /api/enrollments?studentId=xxx — returns all enrollments for a student with service, subject, level, teacher relations
- Created POST /api/enrollments — creates enrollment; on first enrollment for a student, also updates student.levelId/teacherId/monthlyFee for backward compatibility
- Created PUT /api/enrollments/[id] — updates any of: subjectId, levelId, teacherId, monthlyFee, status
- Created DELETE /api/enrollments/[id] — deletes enrollment; if it was the student's primary enrollment (matches student.levelId), clears student.levelId/teacherId/monthlyFee
- All routes use Next.js 16 App Router pattern with `params: Promise<{id}>` and `await params`
- Verified no new type errors introduced (all pre-existing)

Stage Summary:
- New files: src/app/api/enrollments/route.ts, src/app/api/enrollments/[id]/route.ts
- 5 endpoints: GET (list), POST (create), PUT (update), DELETE (remove)
- Backward compat maintained: first enrollment syncs to student record; deletion of primary enrollment clears it

---
Task ID: 3
Agent: fullstack-dev
Task: Update student API routes for multi-enrollment support

Work Log:
- Refactored GET /api/students to extract shared `calcPaymentStatus()` helper from inline enrichment logic
- GET /api/students now includes `enrollments` with nested service/subject/level/teacher + per-enrollment payments
- Multi-enrollment enrichment: calculates isPackPaid + nextDueDate per enrollment; student-level isPackPaid = ALL enrollments paid
- Legacy path preserved: students without enrollments use student-level payments (existing logic)
- POST /api/students: accepts `enrollments` array in body; uses `db.$transaction` for atomic student + enrollments creation
- POST /api/students: sets student.levelId/teacherId/monthlyFee from first enrollment for backward compatibility
- POST /api/students: falls back to old behavior (body.levelId/teacherId/monthlyFee) when no enrollments array
- GET /api/students/[id]: added enrollments include with full nested relations
- PUT /api/students/[id]: accepts `enrollments` array; uses transaction to delete old + create new enrollments atomically
- PUT /api/students/[id]: updates student.levelId/teacherId/monthlyFee from first enrollment; falls back to old behavior otherwise
- All response shapes include enrollments array (empty for legacy students)
- Verified: no new TypeScript errors in student API files

Stage Summary:
- Updated files: src/app/api/students/route.ts, src/app/api/students/[id]/route.ts
- GET list: per-enrollment payment enrichment with student-level aggregation
- POST/PUT: transactional enrollment creation/replacement with backward-compatible student field sync
- Fully backward compatible: existing students without enrollments work identically

---
Task ID: 4
Agent: fullstack-dev
Task: Update teacher payments API for multi-enrollment system

Work Log:
- Extracted shared `calcPaymentContribution()` helper from duplicated inline payment coverage logic in both route files
- GET /api/teacher-payments?calculate=true — complete rewrite of calculation mode:
  - Fetches active StudentEnrollments (with student, service, subject, level, teacher includes) instead of filtering students by teacherId
  - Fetches legacy students (teacherId on student, `enrollments: { none: {} }`) for backward compatibility
  - Fetches enrollment-linked payments (where enrollmentId IN teacher's enrollment IDs) separately from legacy payments
  - Calculates per-enrollment contribution map: `contributionByEnrollment` using the pack coverage algorithm
  - Calculates per-legacy-student contribution map: `legacyContributionByStudent` using same algorithm
  - Per teacher: merges enrollment students + legacy students; totalStudents = unique students (Set), not enrollment count
  - Groups now use enrollment's service/subject/level (new system) or student's level (legacy), with unique student counting per group via Set
  - Student details aggregate multi-enrollment students into single row with summed monthly amount
  - Removed dead `paymentsByStudent` map (built but never used in response)
- GET /api/teacher-payments/bon — same hybrid enrollment + legacy approach for receipt generation:
  - Replaced `db.student.findMany({ where: { teacherId } })` with enrollment fetch + legacy fetch
  - Same contribution calculation split (enrollment-linked vs legacy)
  - Groups use enrollment's level/subject for grouping
  - Student details aggregate per unique student
  - HTML template unchanged
- Kept all existing helper functions (getPrevMonth, getNextMonth, addMonths, isSameMonth, getLastDayOfMonth)
- Verified: no new TypeScript errors introduced (all errors are pre-existing in unrelated files)

Stage Summary:
- Updated files: src/app/api/teacher-payments/route.ts, src/app/api/teacher-payments/bon/route.ts
- Calculation mode now supports multi-enrollment: students linked via StudentEnrollment with per-enrollment payment attribution
- Legacy students (no enrollments, teacherId on student) continue to work with original logic
- Student counts are unique per teacher, group counts are unique per group
- Bon (receipt) generation fully supports the enrollment system

---
Task ID: 5
Agent: fullstack-dev
Task: Update overdue API routes for per-enrollment overdue calculation

Work Log:
- Added `enrollmentId?: string`, `serviceName?: string`, `levelNameForGroup?: string` to OverdueStudent interface in /api/payments/overdue/route.ts
- Added `serviceId: null` and `enrollmentDate: null` to both return paths in `calculateStudentOverdue` to satisfy the OverdueStudent type
- Rewrote GET /api/payments/overdue handler:
  - Fetches active students with `enrollments` (include service, subject, level, teacher) and legacy `level` (include subject→service)
  - Batch-fetches enrollment-linked payments via `enrollmentId: { in: allEnrollmentIds }` (optimized, no N+1)
  - Batch-fetches legacy payments via `studentId: { in: legacyStudentIds }, enrollmentId: null`
  - Groups enrollment payments by enrollmentId, legacy payments by studentId
  - For students WITH enrollments: iterates each enrollment, calls `calculateStudentOverdue` with `enrollment.monthlyFee`, sets `enrollmentId`/`subjectName`/`levelName`/`serviceId`/`serviceName`/`levelNameForGroup` from enrollment
  - For students WITHOUT enrollments: legacy path identical to original behavior
  - Grouping now uses `overdue.serviceName` and `overdue.levelNameForGroup` directly (no studentById lookup needed)
  - Response format unchanged: Service → Level → Students, but students can appear in multiple groups
- Updated /api/classrooms/[id]/overdue/route.ts:
  - Added `enrollmentId?: string` to OverdueStudentInfo interface
  - Extracted inline overdue logic into local `calcClassroomOverdue()` helper (parametric: monthlyFee, enrollmentDate, payments)
  - Added `enrollments` (with service, subject, level) to student include in classroom query
  - Batch-fetches enrollment-linked payments after building studentMap
  - For students WITH enrollments: iterates each enrollment, calls `calcClassroomOverdue` with enrollment.monthlyFee + enrollment payments
  - For students WITHOUT enrollments: calls `calcClassroomOverdue` with student.monthlyFee + student.payments (legacy)
  - Enrollment entries use enrollment's level/subject names; legacy entries use schedule's level/subject names
- All existing Logic A helper functions preserved unchanged
- Timezone remains Africa/Casablanca
- Backward compatible: students without enrollments follow original code paths
- Verified: zero new TypeScript errors in both files

Stage Summary:
- Updated files: src/app/api/payments/overdue/route.ts, src/app/api/classrooms/[id]/overdue/route.ts
- Per-enrollment overdue: each active enrollment generates its own OverdueStudent entry with independent Logic A calculation
- Batch-optimized payment fetching (no per-enrollment queries in loops)
- Legacy students (no enrollments) work identically to before
- A student can appear in multiple Service→Level groups (one per enrollment)

---
Task ID: 6
Agent: fullstack-dev
Task: Update payments-view.tsx for per-enrollment payments

Work Log:
- Added `StudentEnrollmentInfo` and `EnrollmentPaymentInput` interfaces
- Updated `Payment` interface to include optional `enrollmentId` and `enrollment` (with nested service/subject/teacher)
- Updated `StudentSearchResult` to include optional `enrollments?: StudentEnrollmentInfo[]`
- Updated `OverdueStudent` to include `enrollmentId: string | null`
- Added `enrollmentPayments` state (useState<EnrollmentPaymentInput[]>([]))
- Added computed values: `totalEnrollmentAmount`, `totalEnrollmentPaid`
- Added `updateEnrollmentPayment` helper for modifying individual enrollment payment fields
- Modified `handleSelectStudent`: when student has enrollments, populates `enrollmentPayments` array and clears `formData.amount`; otherwise uses legacy single-amount behavior
- Modified `handleClearStudent`: resets `enrollmentPayments` to []
- Modified `handleOpenDialog`: resets `enrollmentPayments` when opening add dialog; pre-fills from `payment.enrollmentId` when editing
- Modified `handleCreateInvoiceForOverdue`: if overdue entry has `enrollmentId`, pre-fills single enrollment payment
- Modified `handleSubmit`: three code paths — batch enrollmentPayments (POST with enrollmentPayments array), single enrollment edit (PUT with enrollmentId), legacy single payment
- Modified payment dialog `onOpenChange` to reset `enrollmentPayments` when dialog closes
- Modified payment form UI: conditional rendering — when `enrollmentPayments.length > 0`, shows per-enrollment grid (service/teacher, amount, paid, discount, pack months selectors) with total row; otherwise shows legacy single-amount fields
- Modified payment table: student column now shows `payment.enrollment.service.nameAr` as teal badge when enrollment exists, falling back to legacy level/subject display
- Modified dialog footer auto-status: enrollment-aware (compares totalEnrollmentPaid vs totalEnrollmentAmount)
- Hidden pack type selector for Langues when in enrollment mode (each enrollment has its own pack selector)
- Added Arabic/French translation keys: amountPerEnrollment, enrollmentAmount, enrollmentPaid, enrollmentDiscount, enrollmentPackMonths, enrollmentService, enrollmentTeacher, noTeacher, totalEnrollmentPayments

Stage Summary:
- Updated files: src/components/views/payments-view.tsx, src/lib/translations.ts
- Full per-enrollment payment support in the payment dialog form
- Batch creation via POST /api/payments with enrollmentPayments array
- Single enrollment edit preserves enrollmentId on PUT
- Service badge shown in payments table for enrollment-linked payments
- Backward compatible: students without enrollments use legacy single-amount flow
- Zero new TypeScript errors introduced (all pre-existing)

---
Task ID: 6
Agent: fullstack-dev
Task: Rewrite students-view multi-service enrollment wizard

Work Log:
- Added `StudentEnrollment` and `EnrollmentSelection` interfaces after existing type definitions
- Added `enrollments?: StudentEnrollment[]` to the `Student` interface
- Added `enrollmentList` (EnrollmentSelection[]) and `currentFee` (string) state variables
- Updated `resetWizard` to clear `enrollmentList` and `currentFee`
- Updated `studentCountsMap` to use Set-based unique student counting across enrollments + legacy teacherId
- Updated `displayedStudents` filter to check both enrollments (serviceId/subjectId/levelId) and legacy student fields
- Rewrote `handleOpenDialog` for edit mode: pre-populates `enrollmentList` from `student.enrollments` (new system) or from `student.level/teacher/monthlyFee` (legacy), always skips to step 5
- Modified `handleSelectTeacher` and `handleSkipTeacher` to go to step 4 (enrollment review) instead of step 5
- Added `saveCurrentSelection` helper: saves current wizard selection + fee to enrollmentList, clears wizard state, navigates to target step
- Rewrote `handleSubmit`: sends `enrollments` array when `enrollmentList.length > 0`, falls back to legacy payload (levelId/teacherId/monthlyFee) otherwise; removed selectedLevel validation when using enrollments
- Redesigned step 4 with two sub-modes:
  - Teacher selection (when no teacher selected): shows teacher list as before
  - Enrollment review (when teacher selected or noTeacher): shows summary card with service/subject/level/teacher badges, fee input, "Add another service" button (→ step 1), "Continue to info" button (→ step 5), and list of already-added enrollments with delete buttons
- Updated step 5 summary badges: shows enrollmentList items (service/subject/level/teacher/fee badges) when enrollments exist, falls back to single-selection badges for legacy
- Monthly fee section in step 5 now only shown in legacy mode (enrollmentList.length === 0)
- Updated student table: level cell shows service+level badges for enrollment students, legacy display otherwise; teacher cell shows comma-joined teacher names for enrollment students; fee cell shows summed enrollment fees
- Updated footer: skip button only shown in teacher selection sub-mode of step 4; back button works from step 5 with enrollments (→ step 1); save button disabled condition handles both enrollment and legacy modes

Stage Summary:
- Updated file: src/components/views/students-view.tsx (1543 → 1864 lines)
- Full multi-service enrollment support in student creation wizard
- Step 4 now serves dual purpose: teacher selection → enrollment review
- "Add another service" flow preserves enrollmentList across service selections
- Edit mode pre-populates from student.enrollments (skips wizard to step 5)
- Student table displays enrollment-aware badges and summed fees
- Teacher count per student uses Set-based unique counting across enrollments
- Backward compatible: legacy single-service students work identically
- Zero new TypeScript errors (all 4 errors in file are pre-existing)