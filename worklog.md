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
