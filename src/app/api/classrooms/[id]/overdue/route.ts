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

/**
 * Add N calendar months to a date, keeping the same day of month.
 * JavaScript's Date constructor already clamps to the last day of the month
 * when the day doesn't exist (e.g., Jan 31 → Feb 28).
 */
function addCalendarMonths(date: Date, months: number): Date {
  const day = date.getDate();
  return new Date(date.getFullYear(), date.getMonth() + months, day);
}

/** Get the effective cycle day for a given month (handles months with fewer days) */
function getEffectiveCycleDay(cycleDay: number, year: number, month: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(cycleDay, lastDayOfMonth);
}

/** Get the start date of a payment */
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

/** Build a set of month-YMs covered by payments */
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
    const overdueStudents: OverdueStudentInfo[] = [];

    for (const [, { student, levelName, subjectName }] of studentMap) {
      const payments = student.payments;
      const enrollmentDate = student.enrollmentDate instanceof Date
        ? student.enrollmentDate
        : new Date(student.enrollmentDate);
      const cycleDay = enrollmentDate.getDate();

      // Check if student has a pending payment for current month
      const currentMonthPending = payments.find(
        (p) => {
          const pYM = toYM(getPaymentStartDate(p));
          return pYM === currentYM && p.remainingAmount > 0;
        }
      );
      const hasPendingPayment = !!currentMonthPending;
      const pendingPaymentId = currentMonthPending?.id || null;

      // Build coverage sets
      const coveredMonths = buildCoveredMonths(payments, true);
      const anyPaymentMonths = buildCoveredMonths(payments, false);

      // ── Step 1: Unpaid payments whose coverage has expired ──
      let unpaidOverdue = 0;
      let maxMonthsOverdue = 0;
      const overduePayments: OverdueStudentInfo['overduePayments'] = [];

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
          });
        }
      }

      // ── Step 2: Expired pack months (sequential) ──
      let packOverdue = 0;
      let packMonthsExpired = 0;

      for (let offset = 1; offset <= 48; offset++) {
        const expectedDate = addCalendarMonths(enrollmentDate, offset);
        const monthYM = toYM(expectedDate);

        if (monthYM > currentYM) break;

        // For the current month, check if the cycle day has arrived
        if (monthYM === currentYM) {
          const effectiveCycleDay = getEffectiveCycleDay(cycleDay, now.getFullYear(), now.getMonth());
          if (todayDate.getDate() < effectiveCycleDay) {
            break;
          }
        }

        // Skip if covered by a fully-paid payment
        if (coveredMonths.has(monthYM)) continue;

        // Skip if there's already an unpaid payment record (avoid double count)
        if (anyPaymentMonths.has(monthYM)) continue;

        // This month is uncovered and due
        packOverdue += student.monthlyFee;
        packMonthsExpired++;
        break; // Sequential: only show first unpaid month
      }

      const totalOverdue = unpaidOverdue + packOverdue;
      if (totalOverdue <= 0) continue;

      // Calculate next due date for display
      let nextDueDate: string | null = null;
      for (let offset = 0; offset <= 60; offset++) {
        const expectedDate = addCalendarMonths(enrollmentDate, offset);
        const monthYM = toYM(expectedDate);
        if (monthYM > currentYM) break;
        if (!coveredMonths.has(monthYM)) {
          const effectiveDay = getEffectiveCycleDay(cycleDay, expectedDate.getFullYear(), expectedDate.getMonth());
          nextDueDate = formatDate(new Date(expectedDate.getFullYear(), expectedDate.getMonth(), effectiveDay));
          break;
        }
      }

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
        monthsOverdue: Math.max(maxMonthsOverdue, packMonthsExpired),
        hasPendingPayment,
        pendingPaymentId,
        nextDueDate,
        overduePayments,
      });
    }

    // Sort by nextDueDate descending (newest date first = top, oldest date last = bottom)
    overdueStudents.sort((a, b) => {
      if (!a.nextDueDate && !b.nextDueDate) return b.totalOverdue - a.totalOverdue;
      if (!a.nextDueDate) return 1;
      if (!b.nextDueDate) return -1;
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