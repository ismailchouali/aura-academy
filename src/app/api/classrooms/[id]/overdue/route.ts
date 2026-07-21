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

  const sortedPaid = payments
    .filter(p => p.remainingAmount === 0)
    .map(p => ({
      date: p.paymentDate
        ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
        : new Date(p.year, getMonthIndex(p.month), 1),
      packMonths: p.packMonths || 1,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

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
  enrollmentId: string | null;
  teacherName: string | null;
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

    // 1. Get the classroom with its schedules and levels
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
    const studentIds: string[] = [];
    const studentLevelMap = new Map<string, { levelName: string; subjectName: string }>();

    for (const schedule of classroom.schedules) {
      if (!schedule.level) continue;
      for (const student of schedule.level.students) {
        if (!studentLevelMap.has(student.id)) {
          studentLevelMap.set(student.id, {
            levelName: schedule.level.nameAr,
            subjectName: schedule.level.subject?.nameAr || '',
          });
        }
      }
    }

    if (studentLevelMap.size === 0) {
      return NextResponse.json({ students: [], totalOverdue: 0 });
    }

    // 3. Fetch all active enrollments for these students that match the classroom's levels
    const allStudentIds = Array.from(studentLevelMap.keys());
    const classroomLevelIds = [...new Set(
      classroom.schedules
        .map(s => s.levelId)
        .filter((id): id is string => !!id)
    )];

    const enrollments = await db.studentEnrollment.findMany({
      where: {
        studentId: { in: allStudentIds },
        status: 'active',
        ...(classroomLevelIds.length > 0 ? { levelId: { in: classroomLevelIds } } : {}),
      },
      include: {
        student: true,
        service: true,
        subject: true,
        level: true,
        teacher: true,
      },
    });

    // Also get students who have NO enrollments matching classroom levels (legacy)
    const enrolledStudentIds = new Set(enrollments.map(e => e.studentId));
    const legacyStudentIds = allStudentIds.filter(sid => !enrolledStudentIds.has(sid));

    // 4. Fetch all payments for these students
    const allPayments = allStudentIds.length > 0
      ? await db.payment.findMany({
          where: { studentId: { in: allStudentIds } },
        })
      : [];

    // Build payment maps
    const paymentsByEnrollment = new Map<string, typeof allPayments>();
    const paymentsByStudent = new Map<string, typeof allPayments>();

    for (const p of allPayments) {
      if (p.enrollmentId) {
        const list = paymentsByEnrollment.get(p.enrollmentId);
        if (list) { list.push(p); } else { paymentsByEnrollment.set(p.enrollmentId, [p]); }
      } else {
        const list = paymentsByStudent.get(p.studentId);
        if (list) { list.push(p); } else { paymentsByStudent.set(p.studentId, [p]); }
      }
    }

    // 5. Calculate overdue for each enrollment
    const now = getMoroccoNow();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentYM = toYM(now);
    const currentMonth = MONTH_ORDER[now.getMonth()];
    const currentYear = now.getFullYear();
    const overdueStudents: OverdueStudentInfo[] = [];

    // Process enrollment-based overdue
    for (const enrollment of enrollments) {
      const student = enrollment.student;
      const payments = paymentsByEnrollment.get(enrollment.id) || [];

      const enrollmentDate = enrollment.enrollmentDate instanceof Date
        ? enrollment.enrollmentDate
        : new Date(enrollment.enrollmentDate);
      const cycleDay = enrollmentDate.getDate();

      // Build covered months using queue-based Logic A
      const { coveredMonths: coveredMonthsForDue } = buildCoverageSets(enrollmentDate, payments);

      // Find first uncovered month using fixed cycle day
      let nextDueDateObj: Date | null = null;
      for (let offset = 1; offset <= 60; offset++) {
        const monthIndex = enrollmentDate.getMonth() + offset;
        const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIndex / 12);
        const targetMonth = monthIndex % 12;
        const monthYM = targetYear * 12 + targetMonth;
        if (monthYM > currentYM) break;
        if (!coveredMonthsForDue.has(monthYM)) {
          nextDueDateObj = getCycleDate(targetYear, targetMonth, cycleDay);
          break;
        }
      }

      // Day-level check
      if (nextDueDateObj && todayDate < nextDueDateObj) {
        continue;
      }

      let totalOverdue = 0;
      let maxMonthsOverdue = 0;
      let hasPendingPayment = false;
      let pendingPaymentId: string | null = null;
      let nextDueDate: string | null = nextDueDateObj ? formatDate(nextDueDateObj) : null;
      const overduePayments: OverdueStudentInfo['overduePayments'] = [];

      // Check if has a pending payment for current month
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
        const enrollmentYM = toYM(enrollmentDate);
        const enrollmentDay = enrollmentDate.getDate();
        const firstDueYM = enrollmentYM + 1;
        if (firstDueYM > currentYM) continue;

        if (firstDueYM === currentYM) {
          const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const effectiveCycleDay = Math.min(enrollmentDay, lastDayOfMonth);
          if (todayDate.getDate() < effectiveCycleDay) continue;
        }

        totalOverdue = enrollment.monthlyFee;
        maxMonthsOverdue = 1;
      } else {
        const { coveredMonths, anyPaymentMonths } = buildCoverageSets(enrollmentDate, payments);

        // Find unpaid payments whose coverage has passed
        for (const p of payments) {
          if (p.remainingAmount > 0) {
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

          for (let offset = 1; offset <= 48; offset++) {
            const monthIndex = enrollmentDate.getMonth() + offset;
            const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIndex / 12);
            const targetMonth = monthIndex % 12;
            const monthYM = targetYear * 12 + targetMonth;

            if (monthYM > currentYM) break;

            if (monthYM === currentYM) {
              const effectiveCycleDay = getEffectiveCycleDay(cycleDay, now.getFullYear(), now.getMonth());
              if (todayDate.getDate() < effectiveCycleDay) {
                break;
              }
            }

            if (!coveredMonths.has(monthYM) && !anyPaymentMonths.has(monthYM)) {
              packOverdue += enrollment.monthlyFee;
              packMonthsExpired++;
              lastOverdueMonthYM = monthYM;
            }

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
        const levelInfo = studentLevelMap.get(student.id);
        overdueStudents.push({
          studentId: student.id,
          studentName: student.fullName,
          phone: student.phone,
          parentPhone: student.parentPhone,
          parentName: student.parentName,
          monthlyFee: enrollment.monthlyFee,
          levelName: enrollment.level?.nameAr || levelInfo?.levelName || '',
          subjectName: enrollment.subject?.nameAr || levelInfo?.subjectName || '',
          totalOverdue,
          monthsOverdue: maxMonthsOverdue,
          hasPendingPayment,
          pendingPaymentId,
          nextDueDate,
          enrollmentId: enrollment.id,
          teacherName: enrollment.teacher?.fullName || null,
          overduePayments,
        });
      }
    }

    // Process legacy students (no enrollment for classroom levels)
    if (legacyStudentIds.length > 0) {
      const legacyStudentsFull = await db.student.findMany({
        where: { id: { in: legacyStudentIds } },
        include: { payments: true },
      });

      for (const student of legacyStudentsFull) {
        const payments = paymentsByStudent.get(student.id) || [];
        const levelInfo = studentLevelMap.get(student.id);

        const enrollmentDate = student.enrollmentDate instanceof Date
          ? student.enrollmentDate
          : new Date(student.enrollmentDate);
        const cycleDay = enrollmentDate.getDate();

        const { coveredMonths: coveredMonthsForDue } = buildCoverageSets(enrollmentDate, payments);

        let nextDueDateObj: Date | null = null;
        for (let offset = 1; offset <= 60; offset++) {
          const monthIndex = enrollmentDate.getMonth() + offset;
          const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIndex / 12);
          const targetMonth = monthIndex % 12;
          const monthYM = targetYear * 12 + targetMonth;
          if (monthYM > currentYM) break;
          if (!coveredMonthsForDue.has(monthYM)) {
            nextDueDateObj = getCycleDate(targetYear, targetMonth, cycleDay);
            break;
          }
        }

        if (nextDueDateObj && todayDate < nextDueDateObj) {
          continue;
        }

        let totalOverdue = 0;
        let maxMonthsOverdue = 0;
        let hasPendingPayment = false;
        let pendingPaymentId: string | null = null;
        let nextDueDate: string | null = nextDueDateObj ? formatDate(nextDueDateObj) : null;
        const overduePayments: OverdueStudentInfo['overduePayments'] = [];

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
          const enrollmentYM = toYM(enrollmentDate);
          const enrollmentDay = enrollmentDate.getDate();
          const firstDueYM = enrollmentYM + 1;
          if (firstDueYM > currentYM) continue;

          if (firstDueYM === currentYM) {
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const effectiveCycleDay = Math.min(enrollmentDay, lastDayOfMonth);
            if (todayDate.getDate() < effectiveCycleDay) continue;
          }

          totalOverdue = student.monthlyFee;
          maxMonthsOverdue = 1;
        } else {
          const { coveredMonths, anyPaymentMonths } = buildCoverageSets(enrollmentDate, payments);

          for (const p of payments) {
            if (p.remainingAmount > 0) {
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

            for (let offset = 1; offset <= 48; offset++) {
              const monthIndex = enrollmentDate.getMonth() + offset;
              const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIndex / 12);
              const targetMonth = monthIndex % 12;
              const monthYM = targetYear * 12 + targetMonth;

              if (monthYM > currentYM) break;

              if (monthYM === currentYM) {
                const effectiveCycleDay = getEffectiveCycleDay(cycleDay, now.getFullYear(), now.getMonth());
                if (todayDate.getDate() < effectiveCycleDay) {
                  break;
                }
              }

              if (!coveredMonths.has(monthYM) && !anyPaymentMonths.has(monthYM)) {
                packOverdue += student.monthlyFee;
                packMonthsExpired++;
                lastOverdueMonthYM = monthYM;
              }

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
            levelName: levelInfo?.levelName || '',
            subjectName: levelInfo?.subjectName || '',
            totalOverdue,
            monthsOverdue: maxMonthsOverdue,
            hasPendingPayment,
            pendingPaymentId,
            nextDueDate,
            enrollmentId: null,
            teacherName: null,
            overduePayments,
          });
        }
      }
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