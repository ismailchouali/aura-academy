import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_LABELS: Record<string, string> = {
  January: 'يناير', February: 'فبراير', March: 'مارس', April: 'أبريل',
  May: 'ماي', June: 'يونيو', July: 'يوليوز', August: 'غشت',
  September: 'شتنبر', October: 'أكتوبر', November: 'نونبر', December: 'دجنبر',
};

function getMonthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month);
}

/** Get current date/time in Africa/Casablanca timezone */
function getMoroccoNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca' }));
}

/** Convert a Date to year*12 + monthIndex for easy month-level arithmetic */
function toYM(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

/** Format a Date to dd/mm/yyyy */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Get the effective cycle day for a given month (handles months with fewer days) */
function getEffectiveCycleDay(cycleDay: number, year: number, monthIndex: number): number {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(cycleDay, lastDayOfMonth);
}

/**
 * Build a date for a specific year/month using the enrollment cycle day.
 * E.g. cycleDay=31, month=Feb(1) → Feb 28
 */
function getCycleDate(year: number, monthIndex: number, cycleDay: number): Date {
  const effectiveDay = getEffectiveCycleDay(cycleDay, year, monthIndex);
  return new Date(year, monthIndex, effectiveDay);
}

/**
 * Build coverage sets using Logic A: FIXED cycle day from enrollment.
 * Fully-paid payments are sorted by date and assigned to enrollment cycle months
 * in queue order. This prevents cycle day drift when payments are made late.
 *
 * Example: enrolled 28/03, payments on [28/03, 25/04, 09/06]
 * → Queue covers: March, April, May (NOT June, even though 3rd payment was on 09/06)
 */
function buildCoverageSets(
  enrollmentDate: Date,
  payments: Array<{
    remainingAmount: number;
    paymentDate: Date | string | null;
    month: string;
    year: number;
    packMonths: number;
  }>
): { coveredMonths: Set<number>; anyPaymentMonths: Set<number> } {
  const coveredMonths = new Set<number>();
  const anyPaymentMonths = new Set<number>();

  // Queue-based: sort fully-paid payments by date ascending
  const sortedPaid = payments
    .filter(p => p.remainingAmount === 0)
    .map(p => ({
      date: p.paymentDate
        ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
        : new Date(p.year, getMonthIndex(p.month), 1),
      packMonths: p.packMonths || 1,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Assign each paid payment to the next N cycle months from enrollment
  let nextCycleOffset = 0;
  for (const payment of sortedPaid) {
    for (let i = 0; i < payment.packMonths && nextCycleOffset < 60; i++) {
      const mi = enrollmentDate.getMonth() + nextCycleOffset;
      const ty = enrollmentDate.getFullYear() + Math.floor(mi / 12);
      const tm = mi % 12;
      const ym = ty * 12 + tm;
      coveredMonths.add(ym);
      anyPaymentMonths.add(ym);
      nextCycleOffset++;
    }
  }

  // For unpaid/partial payments: use their month/year field
  for (const p of payments) {
    if (p.remainingAmount > 0) {
      const baseYM = p.year * 12 + getMonthIndex(p.month);
      anyPaymentMonths.add(baseYM);
      for (let i = 1; i < p.packMonths; i++) {
        const mi = getMonthIndex(p.month) + i;
        const ty = p.year + Math.floor(mi / 12);
        const tm = mi % 12;
        anyPaymentMonths.add(ty * 12 + tm);
      }
    }
  }

  return { coveredMonths, anyPaymentMonths };
}

/* ------------------------------------------------------------------ */
/*  Per-student overdue calculator                                     */
/* ------------------------------------------------------------------ */

interface OverduePaymentInfo {
  id: string;
  month: string;
  monthLabel: string;
  year: number;
  remainingAmount: number;
  monthsOverdue: number;
  type: 'unpaid' | 'expired_pack';
}

interface OverdueStudent {
  studentId: string;
  studentName: string;
  phone: string | null;
  parentPhone: string | null;
  parentName: string | null;
  monthlyFee: number;
  totalOverdue: number;
  monthsOverdue: number;
  nextDueDate: string | null;
  subjectName: string | null;
  levelName: string | null;
  serviceId: string | null;
  enrollmentDate: string | null;
  overduePayments: OverduePaymentInfo[];
}

/**
 * Calculate the next due date using the ENROLLMENT day as fixed cycle day.
 * Finds the first month (from enrollment) not covered by a fully-paid payment.
 * E.g. enrolled 31/1 → Feb 28 → Mar 31 → Apr 30 (always cycle day 31)
 */
function getNextDueDate(
  enrollmentDate: Date,
  payments: Array<{
    id: string;
    remainingAmount: number;
    month: string;
    year: number;
    packMonths: number;
    paymentDate: Date | string | null;
  }>
): Date | null {
  const cycleDay = enrollmentDate.getDate();
  const now = getMoroccoNow();
  const currentYM = toYM(now);

  // Build covered months using queue-based Logic A (fixed cycle day from enrollment)
  const { coveredMonths } = buildCoverageSets(enrollmentDate, payments);

  // Find the first month from enrollment that's not covered
  for (let offset = 1; offset <= 60; offset++) {
    const year = enrollmentDate.getFullYear();
    const monthIndex = enrollmentDate.getMonth() + offset;
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonth = monthIndex % 12;
    const monthYM = targetYear * 12 + targetMonth;
    if (monthYM > currentYM) return null; // future
    if (!coveredMonths.has(monthYM)) {
      return getCycleDate(targetYear, targetMonth, cycleDay);
    }
  }
  return null;
}

function calculateNextDueDate(
  enrollmentDate: Date,
  payments: Array<{
    id: string;
    remainingAmount: number;
    month: string;
    year: number;
    packMonths: number;
    paymentDate: Date | string | null;
  }>
): string | null {
  const dueDate = getNextDueDate(enrollmentDate, payments);
  return dueDate ? formatDate(dueDate) : null;
}

function calculateStudentOverdue(
  student: {
    id: string;
    fullName: string;
    phone: string | null;
    parentName: string | null;
    parentPhone: string | null;
    monthlyFee: number;
    enrollmentDate: Date;
  },
  payments: Array<{
    id: string;
    remainingAmount: number;
    month: string;
    year: number;
    packMonths: number;
    paymentDate: Date | string | null;
  }>
): OverdueStudent | null {
  const now = getMoroccoNow();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentYM = toYM(now);

  // ── Day-level check: calculate next due date ──
  const nextDue = getNextDueDate(
    student.enrollmentDate instanceof Date
      ? student.enrollmentDate
      : new Date(student.enrollmentDate),
    payments
  );

  // If the next due date hasn't arrived yet (today < due date), NOT overdue
  if (nextDue && todayDate < nextDue) {
    return null;
  }

  /* ── Case A: No payments at all ─────────────────────────────── */

  if (payments.length === 0) {
    const enrollmentDate = student.enrollmentDate instanceof Date
      ? student.enrollmentDate
      : new Date(student.enrollmentDate);
    const enrollmentYM = toYM(enrollmentDate);
    const enrollmentDay = enrollmentDate.getDate();

    // Give 1 month grace after enrollment
    const firstDueYM = enrollmentYM + 1;
    if (firstDueYM > currentYM) return null;

    // For the first due month, check if the payment cycle day has arrived
    if (firstDueYM === currentYM) {
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const effectiveCycleDay = Math.min(enrollmentDay, lastDayOfMonth);
      if (todayDate.getDate() < effectiveCycleDay) return null;
    }

    // Sequential: only show 1 overdue month at a time
    const totalOverdue = student.monthlyFee;
    const nextDueDate = calculateNextDueDate(student.enrollmentDate, []);

    return {
      studentId: student.id,
      studentName: student.fullName,
      phone: student.phone,
      parentPhone: student.parentPhone,
      parentName: student.parentName,
      monthlyFee: student.monthlyFee,
      totalOverdue,
      monthsOverdue: 1,
      nextDueDate,
      subjectName: null,
      levelName: null,
      overduePayments: [],
    };
  }

  /* ── Case B: Student has payments ───────────────────────────── */

  const enrollmentDate = student.enrollmentDate instanceof Date
    ? student.enrollmentDate
    : new Date(student.enrollmentDate);

  // Sort by paymentDate descending (fallback to month/year), then id as tiebreaker
  const sorted = [...payments].sort((a, b) => {
    const aTime = a.paymentDate
      ? new Date(a.paymentDate).getTime()
      : new Date(a.year, getMonthIndex(a.month), 1).getTime();
    const bTime = b.paymentDate
      ? new Date(b.paymentDate).getTime()
      : new Date(b.year, getMonthIndex(b.month), 1).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return b.id.localeCompare(a.id);
  });

  // Build coverage sets using queue-based Logic A (fixed cycle day from enrollment)
  const { coveredMonths, anyPaymentMonths } = buildCoverageSets(enrollmentDate, payments);


  /* Step 1 — Unpaid payments whose coverage period has passed */
  let unpaidOverdue = 0;
  let maxMonthsOverdue = 0;
  const overduePayments: OverduePaymentInfo[] = [];

  for (const p of payments) {
    if (p.remainingAmount > 0) {
      // Use month/year field (not paymentDate) to determine coverage end
      const endYM = p.year * 12 + getMonthIndex(p.month) + (p.packMonths || 1);
      if (currentYM >= endYM) {
        const monthsLate = Math.max(1, currentYM - endYM);
        unpaidOverdue += p.remainingAmount;
        maxMonthsOverdue = Math.max(maxMonthsOverdue, monthsLate);

        overduePayments.push({
          id: p.id,
          month: p.month,
          monthLabel: MONTH_LABELS[p.month] || p.month,
          year: p.year,
          remainingAmount: p.remainingAmount,
          monthsOverdue: monthsLate,
          type: 'unpaid',
        });
      }
    }
  }

  /* Step 2 — Expired pack (latest fully-paid payment) */
  let packOverdue = 0;
  let packMonthsExpired = 0;
  const latestPaid = sorted.find((p) => p.remainingAmount === 0);

  if (latestPaid) {
    const enrollmentDay = enrollmentDate.getDate();

    // Iterate month-by-month from enrollment, using FIXED cycle day (Logic A)
    // Sequential logic: stop at the first month not covered by a PAID payment.
    let lastOverdueMonthYM = -1;
    for (let offset = 1; offset <= 48; offset++) {
      const monthIndex = enrollmentDate.getMonth() + offset;
      const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIndex / 12);
      const targetMonth = monthIndex % 12;
      const monthYM = targetYear * 12 + targetMonth;

      // Stop if future month
      if (monthYM > currentYM) break;

      // For the current month, only count if the cycle day has arrived
      if (monthYM === currentYM) {
        const effectiveCycleDay = getEffectiveCycleDay(enrollmentDay, now.getFullYear(), now.getMonth());
        if (todayDate.getDate() < effectiveCycleDay) {
          break;
        }
      }

      // Only count if not covered by a PAID payment AND not already counted by Step 1
      if (!coveredMonths.has(monthYM) && !anyPaymentMonths.has(monthYM)) {
        packOverdue += student.monthlyFee;
        packMonthsExpired++;
        lastOverdueMonthYM = monthYM;
      }

      // Sequential: stop at the first month that's not fully covered by a PAID payment.
      if (!coveredMonths.has(monthYM)) {
        break;
      }
    }

    if (packMonthsExpired > 0) {
      maxMonthsOverdue = Math.max(maxMonthsOverdue, packMonthsExpired);

      const endMonthIndex = lastOverdueMonthYM % 12;
      const endYear = Math.floor(lastOverdueMonthYM / 12);
      const endMonthName = MONTH_ORDER[endMonthIndex];

      overduePayments.push({
        id: `pack_expired_${latestPaid.id}`,
        month: endMonthName,
        monthLabel: MONTH_LABELS[endMonthName] || endMonthName,
        year: endYear,
        remainingAmount: packOverdue,
        monthsOverdue: packMonthsExpired,
        type: 'expired_pack',
      });
    }
  }

  /* Combine & return */

  const totalOverdue = unpaidOverdue + packOverdue;
  if (totalOverdue <= 0) return null;

  const nextDueDate = calculateNextDueDate(student.enrollmentDate, payments);

  return {
    studentId: student.id,
    studentName: student.fullName,
    phone: student.phone,
    parentPhone: student.parentPhone,
    parentName: student.parentName,
    monthlyFee: student.monthlyFee,
    totalOverdue,
    monthsOverdue: maxMonthsOverdue,
    nextDueDate,
    subjectName: null,
    levelName: null,
    overduePayments,
  };
}

/* ------------------------------------------------------------------ */
/*  GET handler                                                        */
/* ------------------------------------------------------------------ */

export async function GET() {
  try {
    // 1. Fetch ALL active students with their service/level hierarchy
    const students = await db.student.findMany({
      where: { status: 'active' },
      include: {
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
      },
    });

    if (students.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Fetch ALL payments for these students (no remainingAmount filter)
    const studentIds = students.map((s) => s.id);
    const allPayments = await db.payment.findMany({
      where: { studentId: { in: studentIds } },
    });

    // 3. Group payments by student
    const paymentsByStudent = new Map<
      string,
      (typeof allPayments)[number][]
    >();
    for (const p of allPayments) {
      const list = paymentsByStudent.get(p.studentId);
      if (list) {
        list.push(p);
      } else {
        paymentsByStudent.set(p.studentId, [p]);
      }
    }

    // 4. Calculate overdue for each student
    const overdueStudents: OverdueStudent[] = [];
    for (const student of students) {
      const payments = paymentsByStudent.get(student.id) || [];
      const result = calculateStudentOverdue(student, payments);
      if (result) {
        // Attach subject/level info from the student record
        result.subjectName = student?.level?.subject?.nameAr || null;
        result.levelName = student?.level?.nameAr || null;
        result.serviceId = student?.level?.subject?.service?.id || null;
        result.enrollmentDate = student.enrollmentDate instanceof Date
          ? student.enrollmentDate.toISOString()
          : String(student.enrollmentDate);
        overdueStudents.push(result);
      }
    }

    if (overdueStudents.length === 0) {
      return NextResponse.json([]);
    }

    // 5. Build lookup for service/level grouping
    const studentById = new Map(students.map((s) => [s.id, s]));

    // 6. Group by Service → Level → Student
    const serviceMap = new Map<string, Map<string, OverdueStudent[]>>();

    for (const overdue of overdueStudents) {
      const student = studentById.get(overdue.studentId);
      const serviceName =
        student?.level?.subject?.service?.nameAr || 'بدون خدمة';
      const levelName = student?.level?.nameAr || 'بدون مستوى';

      let levelMap = serviceMap.get(serviceName);
      if (!levelMap) {
        levelMap = new Map();
        serviceMap.set(serviceName, levelMap);
      }

      let list = levelMap.get(levelName);
      if (!list) {
        list = [];
        levelMap.set(levelName, list);
      }
      list.push(overdue);
    }

    // 7. Build response array
    const result = Array.from(serviceMap.entries()).map(
      ([service, levelMap]) => {
        const levels = Array.from(levelMap.entries()).map(
          ([level, students]) => {
            // Sort students by nextDueDate descending (newest due date on top) within each level
            students.sort((a, b) => {
              if (!a.nextDueDate && !b.nextDueDate) return b.totalOverdue - a.totalOverdue;
              if (!a.nextDueDate) return 1;
              if (!b.nextDueDate) return -1;
              const parseDate = (d: string) => {
                const [day, month, year] = d.split('/').map(Number);
                return new Date(year, month - 1, day).getTime();
              };
              return parseDate(b.nextDueDate) - parseDate(a.nextDueDate);
            });

            const totalLevelOverdue = students.reduce(
              (sum, s) => sum + s.totalOverdue,
              0
            );

            return {
              level,
              students,
              totalOverdue: totalLevelOverdue,
              studentCount: students.length,
            };
          }
        );

        const totalServiceOverdue = levels.reduce(
          (sum, l) => sum + l.totalOverdue,
          0
        );
        const totalStudentCount = levels.reduce(
          (sum, l) => sum + l.studentCount,
          0
        );

        return {
          service,
          levels,
          totalOverdue: totalServiceOverdue,
          studentCount: totalStudentCount,
        };
      }
    );

    // 8. Sort services by total overdue (descending)
    result.sort((a, b) => b.totalOverdue - a.totalOverdue);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching overdue payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overdue payments' },
      { status: 500 }
    );
  }
}
