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
