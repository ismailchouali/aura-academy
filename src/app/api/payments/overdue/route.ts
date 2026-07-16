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

/**
 * Add N calendar months to a date, keeping the same day of month.
 * If the target month has fewer days (e.g. Jan 31 → Feb), JS auto-clamps
 * to the last day of that month (Feb 28). No extra setDate(0) needed.
 */
function addCalendarMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, day);
  // JavaScript's Date constructor already clamps to the last day of the month.
  // No need for setDate(0) — it would incorrectly go to the previous month.
  return result;
}

/** Get the effective cycle day for a given month (handles months with fewer days) */
function getEffectiveCycleDay(cycleDay: number, year: number, month: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(cycleDay, lastDayOfMonth);
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
  overduePayments: OverduePaymentInfo[];
}

/**
 * Get the start date of a payment (paymentDate or fallback to month/year)
 */
function getPaymentStartDate(payment: {
  paymentDate?: Date | string | null;
  month: string;
  year: number;
}): Date {
  if (payment.paymentDate) {
    return payment.paymentDate instanceof Date ? payment.paymentDate : new Date(payment.paymentDate);
  }
  return new Date(payment.year, getMonthIndex(payment.month), 1);
}

/**
 * Build a set of month-YMs covered by fully-paid payments.
 * A payment covers 'packMonths' months starting from its start date.
 * For example: payment on 13/6 for 1 month → covers June (YM of 13/6)
 *              payment on 13/6 for 3 months → covers June, July, August
 */
function buildCoveredMonths(
  payments: Array<{ remainingAmount: number; paymentDate?: Date | string | null; month: string; year: number; packMonths: number }>,
  fullyPaidOnly: boolean
): Set<number> {
  const months = new Set<number>();
  for (const p of payments) {
    if (fullyPaidOnly && p.remainingAmount !== 0) continue;
    const startDate = getPaymentStartDate(p);
    for (let i = 0; i < (p.packMonths || 1); i++) {
      const coveredDate = addCalendarMonths(startDate, i);
      months.add(toYM(coveredDate));
    }
  }
  return months;
}

/**
 * Calculate the next due date for display purposes.
 * Finds the first month (starting from enrollment) that is not covered by a fully-paid payment.
 */
function calculateNextDueDate(
  enrollmentDate: Date,
  cycleDay: number,
  coveredMonths: Set<number>,
  currentYM: number
): string | null {
  for (let offset = 0; offset <= 60; offset++) {
    const expectedDate = addCalendarMonths(enrollmentDate, offset);
    const monthYM = toYM(expectedDate);
    if (monthYM > currentYM) break;
    if (!coveredMonths.has(monthYM)) {
      // Calculate the actual due date using the cycle day
      const effectiveDay = getEffectiveCycleDay(cycleDay, expectedDate.getFullYear(), expectedDate.getMonth());
      return formatDate(new Date(expectedDate.getFullYear(), expectedDate.getMonth(), effectiveDay));
    }
  }
  return null;
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

  const enrollmentDate = student.enrollmentDate instanceof Date
    ? student.enrollmentDate
    : new Date(student.enrollmentDate);
  const cycleDay = enrollmentDate.getDate();
  const enrollmentYM = toYM(enrollmentDate);

  // Build coverage sets
  const coveredMonths = buildCoveredMonths(payments, true); // fully-paid only
  const anyPaymentMonths = buildCoveredMonths(payments, false); // any payment

  // ── Step 1: Unpaid payments whose coverage has expired ──
  let unpaidOverdue = 0;
  let maxMonthsOverdue = 0;
  const overduePayments: OverduePaymentInfo[] = [];

  for (const p of payments) {
    if (p.remainingAmount <= 0) continue;
    const startDate = getPaymentStartDate(p);
    const endYM = toYM(addCalendarMonths(startDate, p.packMonths));
    if (currentYM >= endYM) {
      const monthsLate = Math.max(1, currentYM - endYM + 1);
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

  // ── Step 2: Expired pack months (sequential) ──
  // Iterate from the month after enrollment to find the first uncovered month
  // where the cycle day has already passed.
  let packOverdue = 0;
  let packMonthsExpired = 0;

  for (let offset = 1; offset <= 48; offset++) {
    const expectedDate = addCalendarMonths(enrollmentDate, offset);
    const monthYM = toYM(expectedDate);

    // Stop if we're in a future month
    if (monthYM > currentYM) break;

    // For the current month, check if the cycle day has arrived
    if (monthYM === currentYM) {
      const effectiveCycleDay = getEffectiveCycleDay(cycleDay, now.getFullYear(), now.getMonth());
      if (todayDate.getDate() < effectiveCycleDay) {
        break; // Not due yet this month
      }
    }

    // Skip if covered by a fully-paid payment
    if (coveredMonths.has(monthYM)) continue;

    // Skip if there's already an unpaid payment record for this month (avoid double count)
    if (anyPaymentMonths.has(monthYM)) continue;

    // This month is uncovered and due — it's overdue
    packOverdue += student.monthlyFee;
    packMonthsExpired++;
    break; // Sequential: only show first unpaid month
  }

  // ── Combine results ──
  const totalOverdue = unpaidOverdue + packOverdue;
  if (totalOverdue <= 0) return null;

  const nextDueDate = calculateNextDueDate(enrollmentDate, cycleDay, coveredMonths, currentYM);

  return {
    studentId: student.id,
    studentName: student.fullName,
    phone: student.phone,
    parentPhone: student.parentPhone,
    parentName: student.parentName,
    monthlyFee: student.monthlyFee,
    totalOverdue,
    monthsOverdue: Math.max(maxMonthsOverdue, packMonthsExpired),
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