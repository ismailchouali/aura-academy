import { NextRequest, NextResponse } from 'next/server';
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

/** Build a date for a specific year/month using the enrollment cycle day */
function getCycleDate(year: number, monthIndex: number, cycleDay: number): Date {
  const effectiveDay = getEffectiveCycleDay(cycleDay, year, monthIndex);
  return new Date(year, monthIndex, effectiveDay);
}

/**
 * Build coverage sets using Logic A: FIXED cycle day from enrollment.
 * Fully-paid payments are sorted by date and assigned to enrollment cycle months
 * in queue order. This prevents cycle day drift when payments are made late.
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

  // Month-field-based: also cover months from the payment's month/year field
  // This handles cases where the user set a different month than the queue would assign
  for (const p of payments) {
    if (p.remainingAmount === 0) {
      for (let i = 0; i < (p.packMonths || 1); i++) {
        const mi = getMonthIndex(p.month) + i;
        const ty = p.year + Math.floor(mi / 12);
        const tm = mi % 12;
        coveredMonths.add(ty * 12 + tm);
        anyPaymentMonths.add(ty * 12 + tm);
      }
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

interface OverdueStudentInfo {
  studentId: string;
  studentName: string;
  phone: string | null;
  parentPhone: string | null;
  parentName: string | null;
  monthlyFee: number;
  levelName: string;
  subjectName: string;
  totalOverdue: number;
  monthsOverdue: number;
  hasPendingPayment: boolean;
  pendingPaymentId: string | null;
  nextDueDate: string | null;
  overduePayments: {
    id: string;
    month: string;
    monthLabel: string;
    year: number;
    remainingAmount: number;
    monthsOverdue: number;
  }[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Get the classroom with its schedules, levels, and students
    const classroom = await db.classroom.findUnique({
      where: { id },
      include: {
        schedules: {
          include: {
            level: {
              include: {
                subject: true,
                students: {
                  where: { status: 'active' },
                  include: {
                    payments: {
                      orderBy: { paymentDate: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    // 2. Collect unique students from all schedules in this classroom
    const studentMap = new Map<
      string,
      {
        student: typeof classroom.schedules[0]['level']['students'][0];
        levelName: string;
        subjectName: string;
      }
    >();

    for (const schedule of classroom.schedules) {
      if (!schedule.level) continue;
      for (const student of schedule.level.students) {
        if (!studentMap.has(student.id)) {
          studentMap.set(student.id, {
            student,
            levelName: schedule.level.nameAr,
            subjectName: schedule.level.subject?.nameAr || '',
          });
        }
      }
    }

    if (studentMap.size === 0) {
      return NextResponse.json({ students: [], totalOverdue: 0 });
    }

    // 3. Calculate overdue for each student
    const now = getMoroccoNow();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentYM = toYM(now);
    const currentMonth = MONTH_ORDER[now.getMonth()];
    const currentYear = now.getFullYear();
    const overdueStudents: OverdueStudentInfo[] = [];

    for (const [, { student, levelName, subjectName }] of studentMap) {
      const payments = student.payments;
      let totalOverdue = 0;
      let maxMonthsOverdue = 0;
      let hasPendingPayment = false;
      let pendingPaymentId: string | null = null;
      let nextDueDate: string | null = null;
      const overduePayments: OverdueStudentInfo['overduePayments'] = [];

      // Check if student has a pending payment for current month
      const currentMonthPending = payments.find(
        (p) =>
          p.month === currentMonth &&
          p.year === currentYear &&
          p.remainingAmount > 0
      );
      if (currentMonthPending) {
        hasPendingPayment = true;
        pendingPaymentId = currentMonthPending.id;
      }

      // ── Calculate next due date using FIXED enrollment cycle day (Logic A) ──
      let nextDueDateObj: Date | null = null;
      const enrollmentDate = student.enrollmentDate instanceof Date
        ? student.enrollmentDate
        : new Date(student.enrollmentDate);
      const cycleDay = enrollmentDate.getDate();

      // Build covered months using queue-based Logic A
      const { coveredMonths: coveredMonthsForDue } = buildCoverageSets(enrollmentDate, payments);

      // Find first uncovered month using fixed cycle day
      for (let offset = 1; offset <= 60; offset++) {
        const monthIndex = enrollmentDate.getMonth() + offset;
        const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIndex / 12);
        const targetMonth = monthIndex % 12;
        const monthYM = targetYear * 12 + targetMonth;
        if (monthYM > currentYM) break;
        if (!coveredMonthsForDue.has(monthYM)) {
          nextDueDateObj = getCycleDate(targetYear, targetMonth, cycleDay);
          nextDueDate = formatDate(nextDueDateObj);
          break;
        }
      }

      // ── Day-level check: if next due date hasn't arrived yet, skip this student ──
      if (nextDueDateObj) {
        if (todayDate < nextDueDateObj) {
          continue; // Not overdue yet
        }
      }

      if (payments.length === 0) {
        // No payments at all - check if enrollment is old enough
        const enrollmentYM = toYM(enrollmentDate);
        const enrollmentDay = enrollmentDate.getDate();
        const firstDueYM = enrollmentYM + 1;
        if (firstDueYM > currentYM) continue; // 1 month grace

        // For the first due month, check if the payment cycle day has arrived
        if (firstDueYM === currentYM) {
          const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const effectiveCycleDay = Math.min(enrollmentDay, lastDayOfMonth);
          if (todayDate.getDate() < effectiveCycleDay) continue;
        }

        // Sequential: only show 1 overdue month at a time
        totalOverdue = student.monthlyFee;
        maxMonthsOverdue = 1;
      } else {
        // Build coverage sets using queue-based Logic A (fixed cycle day from enrollment)
        const { coveredMonths, anyPaymentMonths } = buildCoverageSets(enrollmentDate, payments);

        // Find unpaid payments whose coverage has passed
        for (const p of payments) {
          if (p.remainingAmount > 0) {
            // Use month/year field (not paymentDate) to determine coverage end
            const endYM = p.year * 12 + getMonthIndex(p.month) + (p.packMonths || 1);

            if (currentYM >= endYM) {
              const monthsLate = Math.max(1, currentYM - endYM);
              totalOverdue += p.remainingAmount;
              maxMonthsOverdue = Math.max(maxMonthsOverdue, monthsLate);
              overduePayments.push({
                id: p.id,
                month: p.month,
                monthLabel: MONTH_LABELS[p.month] || p.month,
                year: p.year,
                remainingAmount: p.remainingAmount,
                monthsOverdue: monthsLate,
              });
            }
          }
        }

        // Check for expired pack
        const sorted = [...payments].sort((a, b) => {
          const aTime = a.paymentDate
            ? new Date(a.paymentDate).getTime()
            : new Date(a.year, getMonthIndex(a.month), 1).getTime();
          const bTime = b.paymentDate
            ? new Date(b.paymentDate).getTime()
            : new Date(b.year, getMonthIndex(b.month), 1).getTime();
          return bTime - aTime;
        });

        const latestPaid = sorted.find((p) => p.remainingAmount === 0);
        if (latestPaid) {
          let packOverdue = 0;
          let packMonthsExpired = 0;
          let lastOverdueMonthYM = -1;

          // Iterate from enrollment using FIXED cycle day (Logic A)
          for (let offset = 1; offset <= 48; offset++) {
            const monthIndex = enrollmentDate.getMonth() + offset;
            const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIndex / 12);
            const targetMonth = monthIndex % 12;
            const monthYM = targetYear * 12 + targetMonth;

            if (monthYM > currentYM) break;

            // For the current month, only count if the cycle day has arrived
            if (monthYM === currentYM) {
              const effectiveCycleDay = getEffectiveCycleDay(cycleDay, now.getFullYear(), now.getMonth());
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

            // Sequential: stop at the first month not fully covered
            if (!coveredMonths.has(monthYM)) {
              break;
            }
          }

          if (packMonthsExpired > 0) {
            totalOverdue += packOverdue;
            maxMonthsOverdue = Math.max(maxMonthsOverdue, packMonthsExpired);
          }
        }
      }

      if (totalOverdue > 0) {
        overdueStudents.push({
          studentId: student.id,
          studentName: student.fullName,
          phone: student.phone,
          parentPhone: student.parentPhone,
          parentName: student.parentName,
          monthlyFee: student.monthlyFee,
          levelName,
          subjectName,
          totalOverdue,
          monthsOverdue: maxMonthsOverdue,
          hasPendingPayment,
          pendingPaymentId,
          nextDueDate,
          overduePayments,
        });
      }
    }

    // Sort by nextDueDate descending (newest date first = top, oldest date last = bottom)
    overdueStudents.sort((a, b) => {
      if (!a.nextDueDate && !b.nextDueDate) return b.totalOverdue - a.totalOverdue;
      if (!a.nextDueDate) return 1;
      if (!b.nextDueDate) return -1;
      // nextDueDate is in dd/mm/yyyy format, parse for comparison
      const parseDate = (d: string) => {
        const [day, month, year] = d.split('/').map(Number);
        return new Date(year, month - 1, day).getTime();
      };
      return parseDate(b.nextDueDate) - parseDate(a.nextDueDate);
    });
    const grandTotal = overdueStudents.reduce((s, o) => s + o.totalOverdue, 0);

    return NextResponse.json({
      classroomId: id,
      classroomName: classroom.nameAr,
      students: overdueStudents,
      totalOverdue: grandTotal,
      studentCount: overdueStudents.length,
    });
  } catch (error) {
    console.error('Error fetching classroom overdue payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overdue payments' },
      { status: 500 }
    );
  }
}