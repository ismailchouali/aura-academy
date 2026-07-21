import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month);
}

/** Get current date/time in Africa/Casablanca timezone */
function getMoroccoNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca' }));
}

function toYM(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

/** Get the effective cycle day for a given month (handles months with fewer days) */
function getEffectiveCycleDay(cycleDay: number, year: number, monthIndex: number): number {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(cycleDay, lastDayOfMonth);
}

/**
 * Queue-based Logic A coverage calculation.
 * Given an enrollment date and a list of fully-paid payments, compute
 * which year-months are covered and derive isPackPaid / nextDueDate.
 */
function calculateCoverage(
  enrollmentDate: Date,
  payments: Array<{
    paymentDate: Date | null;
    remainingAmount: number;
    packMonths: number;
    month: string;
    year: number;
  }>,
  currentYM: number,
): { isPackPaid: boolean; nextDueDate: string | null } {
  const cycleDay = enrollmentDate.getDate();

  const sortedPaid = payments
    .filter((p) => p.remainingAmount === 0)
    .map((p) => ({
      date: p.paymentDate
        ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
        : new Date(p.year, getMonthIndex(p.month), 1),
      packMonths: p.packMonths || 1,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const coveredMonths = new Set<number>();
  let nextCycleOffset = 0;
  for (const payment of sortedPaid) {
    for (let i = 0; i < payment.packMonths && nextCycleOffset < 60; i++) {
      const mi = enrollmentDate.getMonth() + nextCycleOffset;
      const ty = enrollmentDate.getFullYear() + Math.floor(mi / 12);
      const tm = mi % 12;
      coveredMonths.add(ty * 12 + tm);
      nextCycleOffset++;
    }
  }

  const isPackPaid = coveredMonths.has(currentYM);

  let nextDueDate: string | null = null;
  for (let offset = 0; offset <= 60; offset++) {
    const monthIdx = enrollmentDate.getMonth() + offset;
    const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIdx / 12);
    const targetMonth = monthIdx % 12;
    const monthYM = targetYear * 12 + targetMonth;
    if (monthYM > currentYM) break;
    if (!coveredMonths.has(monthYM)) {
      const effectiveDay = getEffectiveCycleDay(cycleDay, targetYear, targetMonth);
      const day = String(effectiveDay).padStart(2, '0');
      const month = String(targetMonth + 1).padStart(2, '0');
      const year = targetYear;
      nextDueDate = `${day}/${month}/${year}`;
      break;
    }
  }

  return { isPackPaid, nextDueDate };
}

/* ------------------------------------------------------------------ */
/*  GET /api/students                                                  */
/* ------------------------------------------------------------------ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const levelId = searchParams.get('levelId');
    const teacherId = searchParams.get('teacherId');
    const serviceId = searchParams.get('serviceId');

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (levelId) {
      where.levelId = levelId;
    }
    if (teacherId) {
      where.teacherId = teacherId;
    }
    if (serviceId) {
      where.enrollments = { some: { serviceId } };
    }

    const students = await db.student.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
        teacher: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        enrollments: {
          include: {
            service: true,
            subject: true,
            level: {
              include: {
                subject: { include: { service: true } },
              },
            },
            teacher: true,
            payments: {
              orderBy: { paymentDate: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = getMoroccoNow();
    const currentYM = toYM(now);

    const enrichedStudents = students.map((student) => {
      const activeEnrollments = student.enrollments.filter(
        (e) => e.status === 'active',
      );

      if (activeEnrollments.length > 0) {
        // --- New per-enrollment logic ---
        // Enrich ALL enrollments (active and inactive) with coverage data
        const allEnrollments = student.enrollments.map((enrollment) => {
          const eDate =
            enrollment.enrollmentDate instanceof Date
              ? enrollment.enrollmentDate
              : new Date(enrollment.enrollmentDate);
          const coverage = calculateCoverage(eDate, enrollment.payments, currentYM);
          return { ...enrollment, ...coverage };
        });

        const activeEnriched = allEnrollments.filter((e) => e.status === 'active');

        const studentIsPackPaid = activeEnriched.length > 0 && activeEnriched.every((e) => e.isPackPaid);

        // Earliest nextDueDate across all active enrollments
        const dueDates = activeEnriched
          .map((e) => e.nextDueDate)
          .filter((d): d is string => d !== null)
          .map((d) => {
            const [day, month, year] = d.split('/').map(Number);
            return new Date(year, month - 1, day).getTime();
          });
        const studentNextDueDate =
          dueDates.length > 0
            ? (() => {
                const earliest = new Date(Math.min(...dueDates));
                const day = String(earliest.getDate()).padStart(2, '0');
                const month = String(earliest.getMonth() + 1).padStart(2, '0');
                return `${day}/${month}/${earliest.getFullYear()}`;
              })()
            : null;

        // Sum of active enrollment monthly fees
        const studentMonthlyFee = activeEnrollments.reduce(
          (sum, e) => sum + (e.monthlyFee || 0),
          0,
        );

        const { payments: _payments, ...rest } = student;
        return {
          ...rest,
          monthlyFee: studentMonthlyFee,
          isPackPaid: studentIsPackPaid,
          nextDueDate: studentNextDueDate,
          enrollments: allEnrollments,
        };
      } else {
        // --- Fallback: old student-level Logic A (backward compat) ---
        const payments = student.payments;
        let isPackPaid = false;
        let nextDueDate: string | null = null;

        if (payments.length > 0) {
          const eDate = student.enrollmentDate
            ? (student.enrollmentDate instanceof Date
              ? student.enrollmentDate
              : new Date(student.enrollmentDate))
            : new Date();
          const coverage = calculateCoverage(eDate, payments, currentYM);
          isPackPaid = coverage.isPackPaid;
          nextDueDate = coverage.nextDueDate;
        }

        const { payments: _payments, ...rest } = student;

        return {
          ...rest,
          isPackPaid,
          nextDueDate,
        };
      }
    });

    return NextResponse.json(enrichedStudents);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/students                                                 */
/* ------------------------------------------------------------------ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // --- Build enrollment data for nested creation ---
    let enrollmentCreateData:
      | Array<{
          serviceId: string;
          subjectId?: string | null;
          levelId?: string | null;
          teacherId?: string | null;
          monthlyFee: number;
          packMonths: number;
          enrollmentDate: Date;
        }>
      | undefined;

    if (
      body.enrollments &&
      Array.isArray(body.enrollments) &&
      body.enrollments.length > 0
    ) {
      // New style: explicit enrollments array
      enrollmentCreateData = body.enrollments.map((e: Record<string, unknown>) => ({
        serviceId: e.serviceId as string,
        subjectId: (e.subjectId as string) || null,
        levelId: (e.levelId as string) || null,
        teacherId: (e.teacherId as string) || null,
        monthlyFee: (e.monthlyFee as number) ?? 0,
        packMonths: (e.packMonths as number) ?? 1,
        enrollmentDate: e.enrollmentDate
          ? new Date(e.enrollmentDate as string)
          : body.enrollmentDate
            ? new Date(body.enrollmentDate as string)
            : new Date(),
      }));
    } else if (body.levelId) {
      // Backward compat: derive enrollment from student-level levelId
      const level = await db.level.findUnique({
        where: { id: body.levelId },
        include: { subject: { include: { service: true } } },
      });

      if (level) {
        enrollmentCreateData = [
          {
            serviceId: level.subject.service.id,
            subjectId: level.subject.id,
            levelId: body.levelId,
            teacherId: body.teacherId || null,
            monthlyFee: body.monthlyFee ?? 0,
            packMonths: body.packMonths ?? 1,
            enrollmentDate: body.enrollmentDate
              ? new Date(body.enrollmentDate)
              : new Date(),
          },
        ];
      }
    }

    const student = await db.student.create({
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        levelId: body.levelId || null,
        teacherId: body.teacherId || null,
        parentName: body.parentName,
        parentPhone: body.parentPhone,
        monthlyFee: body.monthlyFee ?? 0,
        packMonths: body.packMonths ?? 1,
        status: body.status || 'active',
        enrollmentDate: body.enrollmentDate
          ? new Date(body.enrollmentDate)
          : new Date(),
        ...(enrollmentCreateData
          ? { enrollments: { create: enrollmentCreateData } }
          : {}),
      },
      include: {
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
        teacher: true,
        enrollments: {
          include: {
            service: true,
            subject: true,
            level: {
              include: {
                subject: { include: { service: true } },
              },
            },
            teacher: true,
          },
        },
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}