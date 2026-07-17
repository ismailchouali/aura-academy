---
Task ID: 1
Agent: Main
Task: Fix git state, remove WhatsApp/PDF, hide financial fields from secretary, deploy

Work Log:
- Reset git to origin/main (904a623) to get full project state
- Identified and removed WhatsApp/PDF send feature from payments-view.tsx (generateBonPdf, sendBonWhatsApp functions, MessageCircle icon)
- Identified and removed WhatsApp/PDF send feature from teacher-payments-view.tsx (handleSendWhatsApp function, MessageCircle icon, WhatsApp button)
- Removed /api/payments/bon-pdf/ and /api/teacher-payments/bon-pdf/ API routes
- Removed @react-pdf/renderer from package.json and ran bun install
- Removed public/fonts/ (Tajawal-Bold.ttf, Tajawal-Medium.ttf, Tajawal-Regular.ttf)
- Added isAdmin role checks to students-view.tsx: hidden monthly fee column, payment status column, and monthly fee form section from secretary
- Fixed Next.js slug conflict: merged services/[id]/route.ts into services/[serviceId]/route.ts
- Pushed to GitHub: https://github.com/ismailchouali/aura-academy.git (commit 145e2fd)
- Deployed to Vercel: https://my-project-one-sand-89.vercel.app

Stage Summary:
- WhatsApp/PDF feature completely removed from both payment views
- Financial fields (monthly fee, payment status) hidden from secretary in students view
- Payments view already had proper isAdmin guards (المطلوب, الخصم, المدفوع, المتبقي)
- App compiles and runs successfully on dev server (200)
- Vercel production build successful (no bon-pdf routes in build output)

---
Task ID: 2
Agent: Main
Task: Auto-remove expired trial sessions from schedule

Work Log:
- Analyzed schedule system: trial sessions had no specific date, just dayOfWeek
- Added trialDate DateTime? field to Schedule model in Prisma schema
- Pushed schema to Neon PostgreSQL database (via aura-academy Vercel project env)
- Modified GET /api/schedules: auto-delete expired trials (trialDate < today), filter remaining
- Modified POST /api/schedules: save trialDate when sessionType is 'trial'
- Modified PUT /api/schedules/[id]: update trialDate
- Modified GET /api/dashboard: exclude expired trials from todaySessions
- Updated schedule-view.tsx form: added date picker for trial sessions with validation
- Updated schedule-view.tsx tooltips and print view to show trial date
- Updated description text: "كتحيد من الجدول بعد ما تعدي"

Stage Summary:
- Trial sessions now require a specific date
- Expired trial sessions are auto-deleted on every schedule fetch
- Dashboard todaySessions excludes expired trials
- All time comparisons use Africa/Casablanca timezone

---
Task ID: 3
Agent: Main
Task: Fix financial reports - teacher expenses based on student payment coverage, not TeacherPayment records

Work Log:
- Analyzed user complaint: April showing 0 professor expenses, but professors were paid in May for April's work
- Root cause: dashboard API used TeacherPayment records (when payment was made) instead of calculating what professors EARNED for teaching in each month
- Replaced monthlyTeacherPayments calculation in /api/dashboard/route.ts with student-payment-coverage-based algorithm
- New algorithm (same as teacher-payments API calculate=true mode):
  - For each active student's payment, calculate monthlyAmount = paidAmount / packMonths
  - Determine effectiveStart month based on payment date (day 1-15 → next month, day 16-end → month after next)
  - Check if each month of targetYear falls within payment coverage period
  - Teacher expense = monthlyAmount × teacher.percentage / 100
- Added year query parameter support to dashboard API for cross-year filtering
- Updated financial-reports-view.tsx to re-fetch data when year filter changes (added useRef + useEffect for year changes)
- Code compiles and runs correctly (verified via dev server)

Stage Summary:
- Expenses now correctly reflect what professors EARNED for teaching in each month
- If student paid in April, professor teaches from May (effective start), so expense shows under May
- Year filtering now works: changing year in financial reports re-fetches data from API
- Files modified: src/app/api/dashboard/route.ts, src/components/views/financial-reports-view.tsx

---
Task ID: 4
Agent: Main
Task: Fix expense calculation - use Payment.month instead of effectiveStart delay

Work Log:
- User reported April still showing 0 expenses and May showing 7,070 expenses
- Root cause: previous fix used effectiveStart algorithm which pushes expense to NEXT month after student pays
- The effectiveStart algorithm is for determining WHEN to pay the teacher, not which month the expense belongs to
- User's workflow: student pays April → professor teaches April → professor gets PAID in May
- Expense should be in April (month taught), not May (month paid)
- Completely rewrote calculateTeacherExpenses: now uses Payment.month directly
- New logic: expense for month X = sum of (paidAmount × teacher.percentage / 100) for all payments where Payment.month = X
- This is consistent with how revenue is calculated (also uses Payment.month directly)
- Applied same Langues pack division logic (divide by packMonths only for Langues service)
- Simplified the code: no more effectiveStart, addMonths helper functions, or separate calculateTeacherExpenses function
- Code compiles and runs correctly

Stage Summary:
- April expenses now correctly show professor's share for April student payments
- May expenses will show 0 until students pay for May (professors haven't taught May yet)
- Files modified: src/app/api/dashboard/route.ts

---
Task ID: 5
Agent: Main
Task: Revert ALL previous modifications to financial system

Work Log:
- User requested complete revert of all financial report modifications
- User explained new workflow: teachers will be paid at END of each month (not beginning of next month)
- With new workflow, TeacherPayment.month naturally matches the work month
- Reverted 3 files using git checkout to commit f6d7716:
  1. src/app/api/dashboard/route.ts - removed year query param, monthlyTeacherPayments, expense calculation changes
  2. src/components/views/financial-reports-view.tsx - removed month/year filter, expense chart column, net profit card
  3. src/components/views/teacher-payments-view.tsx - removed displayMonth/displayYear for totalThisMonth/totalThisYear
- Reverted database: 6 TeacherPayment records changed from month="4" back to month="5" (year=2026)
- Created temporary /api/revert-teacher-payments endpoint, deployed, called it (6 records updated), then deleted
- Created temporary /api/check-payments endpoint to verify, then deleted
- Final clean commit pushed and deployed

Stage Summary:
- All code restored to original state (before any financial modifications)
- Database data restored: 6 TeacherPayment records back to month="5" (as originally recorded)
- User's new process: pay teachers end of month → TeacherPayment.month will match work month naturally
- Vercel deployed clean version without temporary endpoints

---
Task ID: 6
Agent: Main
Task: Rewrite teacher bon printing with proper format, student details, and fixed calculation algorithm

Work Log:
- User reported bon printing was broken (error messages when trying to print)
- User uploaded PDF showing the expected bon format for teacher "majda bou-louidane"
- Analyzed PDF structure: header (academy name/logo), teacher info, student summary by level, student detail table with payment amounts, total collected from students, teacher's share with percentage, footer
- Root cause of bon errors: the bon API endpoint was doing a self-referencing HTTP fetch to calculate data, which fails on Vercel
- Completely rewrote /api/teacher-payments/bon/route.ts:
  - Removed self-referencing fetch (was causing errors)
  - All calculation now done inline using direct Prisma queries
  - Bon now shows: student summary by level with counts, individual student payments with amounts, total collected from students, teacher's percentage and calculated share
  - Format matches the uploaded PDF example
  - Proper print button and print CSS
- Fixed payment coverage algorithm in BOTH bon endpoint AND teacher-payments/route.ts:
  - OLD: paid 1-15 → effectiveStart = next month; paid 16+ → month after next
  - NEW: paid 1-15 → effectiveStart = SAME month; paid 16+ → next month
  - This matches user's workflow: teachers paid at end of month, so if student pays before 15th, teacher gets paid this month
- Pushed 2 commits to GitHub (bon rewrite + algorithm fix)
- Auto-deploy via Vercel GitHub integration

Stage Summary:
- Bon endpoint now returns proper HTML with student details and teacher share breakdown
- No more self-referencing fetch that caused Vercel errors
- Payment coverage algorithm corrected to match user's end-of-month payment workflow
- Files modified: src/app/api/teacher-payments/bon/route.ts, src/app/api/teacher-payments/route.ts
---
Task ID: 1
Agent: Main Agent
Task: Fix payment cycle day drift (Logic A) and quick invoice date issues

Work Log:
- Analyzed 6 uploaded screenshots showing due payments bugs
- Identified core bug: `coveredMonths` built using `addCalendarMonths(paymentDate, i)` causes late payments to cover wrong month
- Implemented Logic A (queue-based coverage) in 3 backend files:
  - `src/app/api/payments/overdue/route.ts` - main overdue API
  - `src/app/api/classrooms/[id]/overdue/route.ts` - classroom-specific overdue
  - `src/app/api/students/route.ts` - students list API
- Added `buildCoverageSets()` function: sorts paid payments by date, assigns to enrollment cycle months in queue order
- Fixed `handleCreateInvoiceForOverdue` in `payments-view.tsx` to parse `nextDueDate` (dd/mm/yyyy) and use the scheduled due month/year/paymentDate instead of current date
- Fixed Step 1 (unpaid payments) to use month/year field instead of paymentDate for endYM calculation
- Removed unused functions: `addCalendarMonths`, `isLastDayOfMonth`, `getPaymentEndYM`
- Removed `packDueDate` early-exit check in Step 2 (now uses direct iteration)
- Committed and pushed to GitHub (commit bbd3212)

Stage Summary:
- Salsabil Abounada (enrolled 28/03): payments [28/03, 25/04, 09/06] now correctly cover March, April, May. Next due shows 28/06/2026 instead of wrong 28/05/2026
- Quick invoice creation uses scheduled due date (e.g., 28/06/2026) not current date (17/07/2026)
- Majda Bourmich (enrolled 11/06, paid 11/06): if payment exists with remainingAmount=0, should now correctly show in due payments with nextDueDate 11/07/2026
- Cycle day is permanently fixed from enrollment date - never drifts
