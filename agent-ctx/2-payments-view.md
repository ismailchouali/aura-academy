# Task 2: Payments View Complete Rewrite

## Summary
Completely rewrote `/src/components/views/payments-view.tsx` with all requested features: smart student search, enhanced payments table, overdue payments dialog, and simplified print-ready Bon (receipt).

## Files Modified

### 1. `/src/app/api/students/route.ts`
- Updated the search logic to support **both name AND phone number** search using Prisma OR condition
- Changed from single `fullName` contains to `OR: [{ fullName }, { phone }]`

### 2. `/src/app/api/payments/overdue/route.ts` (NEW)
- New API endpoint returning all students with overdue payments
- Overdue logic: `remainingAmount > 0` AND payment month is at least 1 month in the past
- Results grouped by **Service → Level → Student** (aggregated)
- Each student entry includes: name, phone, parentPhone, parentName, monthlyFee, totalOverdue, monthsOverdue, paymentCount, and individual overdue payment details
- Services sorted by total overdue (descending)

### 3. `/src/components/views/payments-view.tsx` (COMPLETE REWRITE)
**Feature 1 - Smart Student Search:**
- Search input with debounced API calls (300ms)
- Results shown as **small profile cards** in a 2-column grid (not a dropdown)
- Each card shows: avatar icon, name, phone, level/service badge, monthlyFee badge
- On student selection: full profile card with name, phone, parent info, monthly fee, yearly paid amount
- Auto-fills payment amount from `student.monthlyFee`
- Clear/change button to re-select a different student

**Feature 2 - Payments Table:**
- Columns: Student, Month/Year, Amount, Paid, Remaining, Discount, Date, Status, Actions
- Status badges: paid=green, partial=amber, pending=red
- Responsive: columns hidden on smaller screens (md/lg breakpoints)
- Overflow scrolling for long lists

**Feature 3 - Overdue Payments (المدفوعات المستحقة):**
- Amber-bordered button in header area
- Opens a large dialog with:
  - Grand total bar showing total overdue amount
  - Data grouped by Service → Level → Student
  - Each student entry: name, parent name, phone, parent phone, total overdue amount, months overdue count
  - Empty state with green check icon when no overdue payments

**Feature 4 - Bon (Receipt):**
- Simplified, clean receipt that fits on ONE printed page
- Header: "نظام إدارة المركز التربوي" centered
- Address: "الهاتف: 0606030356" and "Bd med V, N°407 Route de Marrakech, Béni Mellal"
- Student info: name, phone only
- Payment details table: amount, discount, net, paid, remaining, month/year, date
- Date format: `DD / MM / YYYY` (e.g., `01 / 03 / 2026`)
- Two signature lines: "توقيع ولي الأمر" and "توقيع المركز"
- `@media print` CSS: hides print button, sets A4 page margins
- `window.print()` auto-triggered after 500ms

**Additional:**
- ScrollArea for both add dialog and overdue dialog (max-h-[90vh])
- Dialog pattern: `<DialogContent className="sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden max-h-[90vh]">`
- Edit mode pre-fills student profile card and form
- Auto-detects payment status (paid/partial/pending) based on amounts
- Summary cards for totals: required, discount, paid, remaining
- Filter bar: month, year, status

## Lint Result
✅ `bun run lint` passed with no errors

## Tech Notes
- Uses existing shadcn/ui components: Dialog, ScrollArea, Card, Table, Select, Input, Badge, Button, AlertBox, Skeleton, Separator
- All API calls use `fetch()` (no server actions)
- Arabic RTL layout throughout
- Theme colors: teal primary, amber accent
- Responsive design with sm/md/lg breakpoints
