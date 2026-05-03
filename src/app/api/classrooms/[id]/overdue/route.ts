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
function addCalMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, day);
  if (result.getDate() !== day) {
    result.setDate(0); // clamp to last day of month (e.g. Jan 31 → Feb 28)
  }
  return result;
}

/** Check if a date is the last day of its month */
function isLastDayOfMonth(date: Date): boolean {
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return nextDay.getMonth() !== date.getMonth();
}

/** Get the end YM for a payment using actual day-level due date */
function getPaymentEndYM(payment: {
  paymentDate?: Date | string | null;
  month: string;
  year: number;
  packMonths: number;
}): number {
  let startDate: Date;
  if (payment.paymentDate) {
    startDate = payment.paymentDate instanceof Date ? payment.paymentDate : new Date(payment.paymentDate);
  } else {
    startDate = new Date(payment.year, getMonthIndex(payment.month), 1);
  }
  const dueDate = addCalMonths(startDate, payment.packMonths);
  return toYM(dueDate);
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
    const now = new Date();
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

      // ── Calculate next due date (day-level) ──
      let nextDueDateObj: Date | null = null;

      if (payments.length > 0) {
        // Sort payments by paymentDate ascending (first payment first)
        const sortedByDate = [...payments].sort((a, b) => {
          const aTime = a.paymentDate
            ? new Date(a.paymentDate).getTime()
            : new Date(a.year, getMonthIndex(a.month), 1).getTime();
          const bTime = b.paymentDate
            ? new Date(b.paymentDate).getTime()
            : new Date(b.year, getMonthIndex(b.month), 1).getTime();
          return aTime - bTime;
        });

        // Find the latest payment to determine current pack duration
        let latestPackPayment: typeof sortedByDate[0] | null = null;
        let latestPackDate: Date | null = null;

        for (const p of sortedByDate) {
          const pDate = p.paymentDate
            ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
            : new Date(p.year, getMonthIndex(p.month), 1);

          if (!latestPackDate || pDate >= latestPackDate) {
            latestPackDate = pDate;
            latestPackPayment = p;
          }
        }

        // Use the latest payment's date + calendar months for due date
        if (latestPackPayment && latestPackDate) {
          const dueDate = addCalMonths(latestPackDate, latestPackPayment.packMonths || 1);
          nextDueDate = formatDate(dueDate);
          nextDueDateObj = dueDate;
        } else {
          // Fallback to first payment + 1 calendar month
          const firstPayment = sortedByDate[0];
          let firstPaymentDate: Date;
          if (firstPayment.paymentDate) {
            firstPaymentDate = firstPayment.paymentDate instanceof Date
              ? firstPayment.paymentDate
              : new Date(firstPayment.paymentDate);
          } else {
            firstPaymentDate = new Date(firstPayment.year, getMonthIndex(firstPayment.month), 1);
          }
          const dueDate = addCalMonths(firstPaymentDate, 1);
          nextDueDate = formatDate(dueDate);
          nextDueDateObj = dueDate;
        }
      } else {
        // No payments - use enrollment date + 1 calendar month
        const enrollmentDate = student.enrollmentDate instanceof Date
          ? student.enrollmentDate
          : new Date(student.enrollmentDate);
        const dueDate = addCalMonths(enrollmentDate, 1);
        nextDueDate = formatDate(dueDate);
        nextDueDateObj = dueDate;
      }

      // ── Day-level check: if next due date hasn't arrived yet, skip this student ──
      if (nextDueDateObj) {
        if (todayDate < nextDueDateObj) {
          continue; // Not overdue yet
        }
      }

      if (payments.length === 0) {
        // No payments at all - check if enrollment is old enough
        const enrollmentYM = toYM(new Date(student.enrollmentDate));
        if (enrollmentYM >= currentYM - 1) continue; // 1 month grace

        const monthsOverdue = currentYM - enrollmentYM - 1;
        totalOverdue = monthsOverdue * student.monthlyFee;
        maxMonthsOverdue = monthsOverdue;
      } else {
        // Build set of covered months using day-level due dates
        // Key fix: use addCalMonths to compute actual due date, and only include
        // the due date month if it's the last day of the month.
        const coveredMonths = new Set<number>();
        for (const p of payments) {
          let startDate: Date;
          if (p.paymentDate) {
            startDate = p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate);
          } else {
            startDate = new Date(p.year, getMonthIndex(p.month), 1);
          }
          const startYM = toYM(startDate);
          const dueDate = addCalMonths(startDate, p.packMonths);
          const dueDateYM = toYM(dueDate);

          // Add the start month
          coveredMonths.add(startYM);

          // Add intermediate months between start and due date month
          for (let m = startYM + 1; m < dueDateYM; m++) {
            coveredMonths.add(m);
          }

          // Add the due date month ONLY if it's the last day of the month
          if (isLastDayOfMonth(dueDate)) {
            coveredMonths.add(dueDateYM);
          }
        }

        // Find unpaid payments whose coverage has passed
        for (const p of payments) {
          if (p.remainingAmount > 0) {
            const endYM = getPaymentEndYM(p);

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
          let packStartDate: Date;
          if (latestPaid.paymentDate) {
            packStartDate = latestPaid.paymentDate instanceof Date
              ? latestPaid.paymentDate
              : new Date(latestPaid.paymentDate);
          } else {
            packStartDate = new Date(latestPaid.year, getMonthIndex(latestPaid.month), 1);
          }
          const packDueDate = addCalMonths(packStartDate, latestPaid.packMonths);

          // Use day-level comparison: only count months whose due date has passed
          if (todayDate >= packDueDate) {
            let packOverdue = 0;
            let packMonthsExpired = 0;

            // Iterate month-by-month using actual due dates
            let checkDate = new Date(packDueDate.getTime());
            while (checkDate <= todayDate) {
              const monthYM = toYM(checkDate);
              if (!coveredMonths.has(monthYM)) {
                packOverdue += student.monthlyFee;
                packMonthsExpired++;
              }
              checkDate = addCalMonths(checkDate, 1);
            }

            if (packMonthsExpired > 0) {
              totalOverdue += packOverdue;
              maxMonthsOverdue = Math.max(maxMonthsOverdue, packMonthsExpired);
            }
          }
        }

        // Also check if current month is not covered at all (no expired pack counted it)
        // Use day-level check: only count if the due date for this month has passed
        if (!coveredMonths.has(currentYM) && !hasPendingPayment) {
          // Determine the payment cycle day from the latest payment
          const latestP = sorted[0]; // sorted by date descending
          if (latestP) {
            let refDate: Date;
            if (latestP.paymentDate) {
              refDate = latestP.paymentDate instanceof Date
                ? latestP.paymentDate
                : new Date(latestP.paymentDate);
            } else {
              refDate = new Date(latestP.year, getMonthIndex(latestP.month), 1);
            }
            const paymentDay = refDate.getDate();
            const dueDateInCurrentMonth = new Date(now.getFullYear(), now.getMonth(), paymentDay);
            // Clamp to last day if needed (e.g., day 31 in a 30-day month)
            if (dueDateInCurrentMonth.getDate() !== paymentDay) {
              dueDateInCurrentMonth.setDate(0);
            }
            if (todayDate >= dueDateInCurrentMonth) {
              totalOverdue += student.monthlyFee;
              maxMonthsOverdue = Math.max(maxMonthsOverdue, 1);
            }
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
