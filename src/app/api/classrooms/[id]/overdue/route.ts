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
                    payments: true,
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

      if (payments.length === 0) {
        // No payments at all - check if enrollment is old enough
        const enrollmentYM = toYM(new Date(student.enrollmentDate));
        if (enrollmentYM >= currentYM - 1) continue; // 1 month grace

        const monthsOverdue = currentYM - enrollmentYM - 1;
        totalOverdue = monthsOverdue * student.monthlyFee;
        maxMonthsOverdue = monthsOverdue;
      } else {
        // Build set of covered months
        const coveredMonths = new Set<number>();
        for (const p of payments) {
          let startYM: number;
          if (p.paymentDate) {
            startYM = toYM(
              p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate)
            );
          } else {
            startYM = p.year * 12 + getMonthIndex(p.month);
          }
          for (let m = 0; m < p.packMonths; m++) {
            coveredMonths.add(startYM + m);
          }
        }

        // Find unpaid payments
        for (const p of payments) {
          if (p.remainingAmount > 0) {
            let startYM: number;
            if (p.paymentDate) {
              startYM = toYM(
                p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate)
              );
            } else {
              startYM = p.year * 12 + getMonthIndex(p.month);
            }
            const endYM = startYM + p.packMonths - 1;

            if (currentYM > endYM) {
              const monthsLate = currentYM - endYM;
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
          let packStartYM: number;
          if (latestPaid.paymentDate) {
            packStartYM = toYM(
              latestPaid.paymentDate instanceof Date
                ? latestPaid.paymentDate
                : new Date(latestPaid.paymentDate)
            );
          } else {
            packStartYM =
              latestPaid.year * 12 + getMonthIndex(latestPaid.month);
          }
          const packEndYM = packStartYM + latestPaid.packMonths - 1;

          if (currentYM > packEndYM) {
            let packOverdue = 0;
            let packMonthsExpired = 0;
            for (let m = packEndYM + 1; m <= currentYM; m++) {
              if (!coveredMonths.has(m)) {
                packOverdue += student.monthlyFee;
                packMonthsExpired++;
              }
            }

            if (packMonthsExpired > 0) {
              totalOverdue += packOverdue;
              maxMonthsOverdue = Math.max(maxMonthsOverdue, packMonthsExpired);
            }
          }
        }

        // Also check if current month is not covered at all
        if (!coveredMonths.has(currentYM) && !hasPendingPayment) {
          totalOverdue += student.monthlyFee;
          maxMonthsOverdue = Math.max(maxMonthsOverdue, 1);
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
          overduePayments,
        });
      }
    }

    // Sort by total overdue descending
    overdueStudents.sort((a, b) => b.totalOverdue - a.totalOverdue);
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
