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
 */
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

/* ------------------------------------------------------------------ */
/*  Per-enrollment overdue calculator                                   */
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
  enrollmentId: string | null;
  teacherName: string | null;
  overduePayments: OverduePaymentInfo[];
}

/**
 * Calculate the next due date using the ENROLLMENT day as fixed cycle day.
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

  const { coveredMonths } = buildCoverageSets(enrollmentDate, payments);

  for (let offset = 1; offset <= 60; offset++) {
    const year = enrollmentDate.getFullYear();
    const monthIndex = enrollmentDate.getMonth() + offset;
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonth = monthIndex % 12;
    const monthYM = targetYear * 12 + targetMonth;
    if (monthYM > currentYM) return null;
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

function calculateEnrollmentOverdue(
  student: {
    id: string;
    fullName: string;
    phone: string | null;
    parentName: string | null;
    parentPhone: string | null;
  },
  enrollment: {
    id: string;
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

  const enrollmentDate = enrollment.enrollmentDate instanceof Date
    ? enrollment.enrollmentDate
    : new Date(enrollment.enrollmentDate);

  // Day-level check
  const nextDue = getNextDueDate(enrollmentDate, payments);
  if (nextDue && todayDate < nextDue) {
    return null;
  }

  /* Case A: No payments at all */
  if (payments.length === 0) {
    const enrollmentYM = toYM(enrollmentDate);
    const enrollmentDay = enrollmentDate.getDate();

    const firstDueYM = enrollmentYM + 1;
    if (firstDueYM > currentYM) return null;

    if (firstDueYM === currentYM) {
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const effectiveCycleDay = Math.min(enrollmentDay, lastDayOfMonth);
      if (todayDate.getDate() < effectiveCycleDay) return null;
    }

    const totalOverdue = enrollment.monthlyFee;
    const nextDueDate = calculateNextDueDate(enrollmentDate, []);

    return {
      studentId: student.id,
      studentName: student.fullName,
      phone: student.phone,
      parentPhone: student.parentPhone,
      parentName: student.parentName,
      monthlyFee: enrollment.monthlyFee,
      totalOverdue,
      monthsOverdue: 1,
      nextDueDate,
      subjectName: null,
      levelName: null,
      serviceId: null,
      enrollmentDate: enrollmentDate.toISOString(),
      enrollmentId: enrollment.id,
      teacherName: null,
      overduePayments: [],
    };
  }

  /* Case B: Enrollment has payments */
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

  const { coveredMonths, anyPaymentMonths } = buildCoverageSets(enrollmentDate, payments);

  /* Step 1 - Unpaid payments whose coverage period has passed */
  let unpaidOverdue = 0;
  let maxMonthsOverdue = 0;
  const overduePayments: OverduePaymentInfo[] = [];

  for (const p of payments) {
    if (p.remainingAmount > 0) {
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

  /* Step 2 - Expired pack (latest fully-paid payment) */
  let packOverdue = 0;
  let packMonthsExpired = 0;
  const latestPaid = sorted.find((p) => p.remainingAmount === 0);

  if (latestPaid) {
    const enrollmentDay = enrollmentDate.getDate();
    let lastOverdueMonthYM = -1;

    for (let offset = 1; offset <= 48; offset++) {
      const monthIndex = enrollmentDate.getMonth() + offset;
      const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIndex / 12);
      const targetMonth = monthIndex % 12;
      const monthYM = targetYear * 12 + targetMonth;

      if (monthYM > currentYM) break;

      if (monthYM === currentYM) {
        const effectiveCycleDay = getEffectiveCycleDay(enrollmentDay, now.getFullYear(), now.getMonth());
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

  const nextDueDate = calculateNextDueDate(enrollmentDate, payments);

  return {
    studentId: student.id,
    studentName: student.fullName,
    phone: student.phone,
    parentPhone: student.parentPhone,
    parentName: student.parentName,
    monthlyFee: enrollment.monthlyFee,
    totalOverdue,
    monthsOverdue: maxMonthsOverdue,
    nextDueDate,
    subjectName: null,
    levelName: null,
    serviceId: null,
    enrollmentDate: enrollmentDate.toISOString(),
    enrollmentId: enrollment.id,
    teacherName: null,
    overduePayments,
  };
}

/* ------------------------------------------------------------------ */
/*  GET handler                                                        */
/* ------------------------------------------------------------------ */

export async function GET() {
  try {
    // 1. Fetch ALL active students (basic info only)
    const students = await db.student.findMany({
      where: { status: 'active' },
    });

    if (students.length === 0) {
      return NextResponse.json([]);
    }

    const studentIds = students.map((s) => s.id);

    // 2. Fetch ALL enrollments for active students with service/subject/level/teacher
    const enrollments = await db.studentEnrollment.findMany({
      where: {
        studentId: { in: studentIds },
        status: 'active',
      },
      include: {
        service: true,
        subject: true,
        level: true,
        teacher: true,
      },
    });

    // 3. Fetch ALL payments for these students
    const allPayments = await db.payment.findMany({
      where: { studentId: { in: studentIds } },
    });

    // 4. Build student lookup
    const studentById = new Map(students.map((s) => [s.id, s]));

    // 5. Build payment maps:
    //    a) paymentsByStudent: for legacy (no enrollmentId) payments
    //    b) paymentsByEnrollment: for enrollment-linked payments
    const paymentsByStudent = new Map<string, typeof allPayments[number][]>();
    const paymentsByEnrollment = new Map<string, typeof allPayments[number][]>();

    for (const p of allPayments) {
      if (p.enrollmentId) {
        const list = paymentsByEnrollment.get(p.enrollmentId);
        if (list) {
          list.push(p);
        } else {
          paymentsByEnrollment.set(p.enrollmentId, [p]);
        }
      } else {
        const list = paymentsByStudent.get(p.studentId);
        if (list) {
          list.push(p);
        } else {
          paymentsByStudent.set(p.studentId, [p]);
        }
      }
    }

    // 6. For each enrollment, calculate overdue
    const overdueResults: OverdueStudent[] = [];

    for (const enrollment of enrollments) {
      const student = studentById.get(enrollment.studentId);
      if (!student) continue;

      const enrollmentPayments = paymentsByEnrollment.get(enrollment.id) || [];

      const result = calculateEnrollmentOverdue(
        student,
        {
          id: enrollment.id,
          monthlyFee: enrollment.monthlyFee,
          enrollmentDate: enrollment.enrollmentDate,
        },
        enrollmentPayments
      );

      if (result) {
        result.subjectName = enrollment.subject?.nameAr || null;
        result.levelName = enrollment.level?.nameAr || null;
        result.serviceId = enrollment.service?.id || null;
        result.enrollmentDate = (enrollment.enrollmentDate instanceof Date
          ? enrollment.enrollmentDate
          : new Date(enrollment.enrollmentDate)
        ).toISOString();
        result.teacherName = enrollment.teacher?.fullName || null;
        overdueResults.push(result);
      }
    }

    // 7. Handle legacy students (students with no active enrollments but with legacy payments)
    const studentsWithEnrollments = new Set(enrollments.map(e => e.studentId));
    const legacyStudentIds = students.filter(s => !studentsWithEnrollments.has(s.id)).map(s => s.id);

    if (legacyStudentIds.length > 0) {
      const legacyStudentsWithLevel = await db.student.findMany({
        where: { id: { in: legacyStudentIds } },
        include: {
          level: {
            include: { subject: { include: { service: true } } },
          },
        },
      });

      for (const student of legacyStudentsWithLevel) {
        const legacyPayments = paymentsByStudent.get(student.id) || [];
        if (legacyPayments.length === 0) continue;

        const enrollmentDate = student.enrollmentDate instanceof Date
          ? student.enrollmentDate
          : new Date(student.enrollmentDate);

        const result = calculateEnrollmentOverdue(
          student,
          {
            id: '__legacy__',
            monthlyFee: student.monthlyFee,
            enrollmentDate,
          },
          legacyPayments
        );

        if (result) {
          result.subjectName = student.level?.subject?.nameAr || null;
          result.levelName = student.level?.nameAr || null;
          result.serviceId = student.level?.subject?.service?.id || null;
          result.enrollmentDate = enrollmentDate.toISOString();
          result.enrollmentId = null;
          result.teacherName = null;
          overdueResults.push(result);
        }
      }
    }

    if (overdueResults.length === 0) {
      return NextResponse.json([]);
    }

    // 8. Group by Service -> Level -> Student
    const serviceMap = new Map<string, Map<string, OverdueStudent[]>>();

    for (const overdue of overdueResults) {
      const serviceName = overdue.subjectName || 'بدون خدمة';
      const levelName = overdue.levelName || 'بدون مستوى';

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

    // 9. Build response array
    const result = Array.from(serviceMap.entries()).map(
      ([service, levelMap]) => {
        const levels = Array.from(levelMap.entries()).map(
          ([level, overdueStudents]) => {
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

            const totalLevelOverdue = overdueStudents.reduce(
              (sum, s) => sum + s.totalOverdue,
              0
            );

            return {
              level,
              students: overdueStudents,
              totalOverdue: totalLevelOverdue,
              studentCount: overdueStudents.length,
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

    // 10. Sort services by total overdue (descending)
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