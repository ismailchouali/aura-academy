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

/** Add N calendar months to a date, keeping the same day of month */
function addCalendarMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, day);
  // If day overflowed (e.g. Jan 31 → Feb 30 doesn't exist), clamp to last day
  if (result.getDate() !== day) {
    result.setDate(0); // last day of previous month
  }
  return result;
}

/** Check if a date is the last day of its month */
function isLastDayOfMonth(date: Date): boolean {
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return nextDay.getMonth() !== date.getMonth();
}

/**
 * Calculate the end month (as YM) of a payment's coverage period.
 * Uses addCalendarMonths to compute the actual due date, then returns its YM.
 * This correctly handles months with different day counts (e.g., Jan 31 → Feb 28).
 */
function getPaymentEndYM(payment: {
  paymentDate?: Date | string | null;
  month: string;
  year: number;
  packMonths: number;
}): number {
  let startDate: Date;
  if (payment.paymentDate) {
    startDate =
      payment.paymentDate instanceof Date
        ? payment.paymentDate
        : new Date(payment.paymentDate);
  } else {
    startDate = new Date(payment.year, getMonthIndex(payment.month), 1);
  }
  const dueDate = addCalendarMonths(startDate, payment.packMonths);
  return toYM(dueDate);
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
  overduePayments: OverduePaymentInfo[];
}

/**
 * Calculate the next due date as a Date object (day-level precision).
 * - No payments: enrollmentDate + 1 month
 * - Has payments: latest paymentDate + packMonths
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
  if (payments.length === 0) {
    return addCalendarMonths(enrollmentDate, 1);
  }

  // Sort payments by paymentDate ascending
  const sortedByDate = [...payments].sort((a, b) => {
    const aTime = a.paymentDate
      ? new Date(a.paymentDate).getTime()
      : new Date(a.year, getMonthIndex(a.month), 1).getTime();
    const bTime = b.paymentDate
      ? new Date(b.paymentDate).getTime()
      : new Date(b.year, getMonthIndex(b.month), 1).getTime();
    return aTime - bTime;
  });

  // Find the latest payment by date
  let latestPayment: typeof sortedByDate[0] | null = null;
  let latestDate: Date | null = null;

  for (const p of sortedByDate) {
    const pDate = p.paymentDate
      ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
      : new Date(p.year, getMonthIndex(p.month), 1);
    if (!latestDate || pDate >= latestDate) {
      latestDate = pDate;
      latestPayment = p;
    }
  }

  if (latestPayment && latestDate) {
    return addCalendarMonths(latestDate, latestPayment.packMonths || 1);
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
  const now = new Date();
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
    const enrollmentYM = toYM(new Date(student.enrollmentDate));

    // Give 1 month grace after enrollment
    if (enrollmentYM >= currentYM - 1) return null;

    const monthsOverdue = currentYM - enrollmentYM - 1;
    const totalOverdue = monthsOverdue * student.monthlyFee;

    const nextDueDate = calculateNextDueDate(student.enrollmentDate, []);

    return {
      studentId: student.id,
      studentName: student.fullName,
      phone: student.phone,
      parentPhone: student.parentPhone,
      parentName: student.parentName,
      monthlyFee: student.monthlyFee,
      totalOverdue,
      monthsOverdue,
      nextDueDate,
      overduePayments: [],
    };
  }

  /* ── Case B: Student has payments ───────────────────────────── */

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

  // Build a set of every month-YM covered by ANY payment record (paid or unpaid).
  // This prevents double-counting: if an unpaid record exists for a month,
  // the expired-pack logic will skip that month.
  //
  // Key fix: use the actual due date (addCalendarMonths) to determine coverage.
  // The due date's month is included ONLY if it's the last day of the month
  // (meaning the payment covers through the end of that month).
  // Example: Jan 31 + 1 month → due date = Feb 28 (last day) → Feb IS covered
  //          Mar 5 + 1 month → due date = Apr 5 (not last day) → Apr NOT covered
  const coveredMonths = new Set<number>();
  for (const p of payments) {
    let startDate: Date;
    if (p.paymentDate) {
      startDate = p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate);
    } else {
      startDate = new Date(p.year, getMonthIndex(p.month), 1);
    }
    const startYM = toYM(startDate);
    const dueDate = addCalendarMonths(startDate, p.packMonths);
    const dueDateYM = toYM(dueDate);

    // Add the start month
    coveredMonths.add(startYM);

    // Add intermediate months between start and due date month
    for (let m = startYM + 1; m < dueDateYM; m++) {
      coveredMonths.add(m);
    }

    // Add the due date month ONLY if it's the last day of the month
    // (e.g., Feb 28 in a non-leap year = last day → Feb is covered)
    if (isLastDayOfMonth(dueDate)) {
      coveredMonths.add(dueDateYM);
    }
  }

  /* Step 1 — Unpaid payments whose coverage period has passed */
  let unpaidOverdue = 0;
  let maxMonthsOverdue = 0;
  const overduePayments: OverduePaymentInfo[] = [];

  for (const p of payments) {
    if (p.remainingAmount > 0) {
      const endYM = getPaymentEndYM(p);
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
    // Compute pack start date and due date
    let packStartDate: Date;
    if (latestPaid.paymentDate) {
      packStartDate =
        latestPaid.paymentDate instanceof Date
          ? latestPaid.paymentDate
          : new Date(latestPaid.paymentDate);
    } else {
      packStartDate = new Date(
        latestPaid.year,
        getMonthIndex(latestPaid.month),
        1
      );
    }
    const packDueDate = addCalendarMonths(packStartDate, latestPaid.packMonths);

    // Use month-level comparison to correctly iterate through overdue months
    if (todayDate >= packDueDate) {
      // Iterate month-by-month using month-level comparison
      // The old day-level check (checkDate <= todayDate) could skip the current month
      // when the pack expired on a day later than today's day in the current month
      let checkDate = new Date(packDueDate.getTime());

      while (toYM(checkDate) <= currentYM) {
        const monthYM = toYM(checkDate);
        if (!coveredMonths.has(monthYM)) {
          packOverdue += student.monthlyFee;
          packMonthsExpired++;
        }
        checkDate = addCalendarMonths(checkDate, 1);
      }

      if (packMonthsExpired > 0) {
        maxMonthsOverdue = Math.max(maxMonthsOverdue, packMonthsExpired);

        const endMonthName = MONTH_ORDER[packDueDate.getMonth()];

        overduePayments.push({
          id: `pack_expired_${latestPaid.id}`,
          month: endMonthName,
          monthLabel: MONTH_LABELS[endMonthName] || endMonthName,
          year: packDueDate.getFullYear(),
          remainingAmount: packOverdue,
          monthsOverdue: packMonthsExpired,
          type: 'expired_pack',
        });
      }
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
