import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

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
 * Calculate isPackPaid and nextDueDate for a set of payments against a cycle start date.
 * Reuses the existing queue-based Logic A (fixed cycle day from enrollment).
 */
function calcPaymentStatus(
  payments: { paymentDate: Date | null; year: number; month: string; packMonths: number; remainingAmount: number }[],
  enrollmentDate: Date,
  currentYM: number
): { isPackPaid: boolean; nextDueDate: string | null } {
  let isPackPaid = false;
  let nextDueDate: string | null = null;

  if (payments.length > 0) {
    const cycleDay = enrollmentDate.getDate();

    const sortedPaid = payments
      .filter(p => p.remainingAmount === 0)
      .map(p => ({
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

    isPackPaid = coveredMonths.has(currentYM);

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
  }

  return { isPackPaid, nextDueDate };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const levelId = searchParams.get('levelId');
    const teacherId = searchParams.get('teacherId');

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

    const students = await db.student.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        enrollments: {
          include: {
            service: true,
            subject: true,
            level: true,
            teacher: true,
            payments: { orderBy: { paymentDate: 'desc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
        teacher: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = getMoroccoNow();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentYM = toYM(now);

    // Calculate payment status for each student
    const enrichedStudents = students.map((student) => {
      const { payments, enrollments, ...studentWithoutPayments } = student;

      if (enrollments.length > 0) {
        // Multi-enrollment path: calculate per-enrollment status
        const enrollmentDate = student.enrollmentDate
          ? (student.enrollmentDate instanceof Date ? student.enrollmentDate : new Date(student.enrollmentDate))
          : new Date();

        const enrichedEnrollments = enrollments.map((enrollment) => {
          const { payments: ePayments, ...enrollmentWithoutPayments } = enrollment;
          const { isPackPaid, nextDueDate } = calcPaymentStatus(ePayments, enrollmentDate, currentYM);
          return {
            ...enrollmentWithoutPayments,
            isPackPaid,
            nextDueDate,
          };
        });

        // Student isPackPaid = ALL enrollments are paid for current month
        const isPackPaid = enrichedEnrollments.every(e => e.isPackPaid);

        return {
          ...studentWithoutPayments,
          enrollments: enrichedEnrollments,
          isPackPaid,
          nextDueDate: null, // Not meaningful at student level with multiple enrollments
        };
      } else {
        // Legacy path: no enrollments, use student-level payments
        const { isPackPaid, nextDueDate } = calcPaymentStatus(payments, student.enrollmentDate instanceof Date ? student.enrollmentDate : new Date(student.enrollmentDate || Date.now()), currentYM);

        return {
          ...studentWithoutPayments,
          enrollments: [],
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const enrollmentsData: Array<{
      serviceId: string;
      subjectId?: string;
      levelId?: string;
      teacherId?: string;
      monthlyFee?: number;
    }> | undefined = body.enrollments;

    if (enrollmentsData && enrollmentsData.length > 0) {
      // New multi-enrollment path: use transaction
      const firstEnrollment = enrollmentsData[0];

      const result = await db.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            fullName: body.fullName,
            phone: body.phone,
            email: body.email,
            address: body.address,
            levelId: firstEnrollment.levelId || null,
            teacherId: firstEnrollment.teacherId || null,
            parentName: body.parentName,
            parentPhone: body.parentPhone,
            monthlyFee: firstEnrollment.monthlyFee ?? 0,
            packMonths: body.packMonths ?? 1,
            status: body.status || 'active',
            enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate) : new Date(),
            enrollments: {
              create: enrollmentsData.map((e) => ({
                serviceId: e.serviceId,
                subjectId: e.subjectId || null,
                levelId: e.levelId || null,
                teacherId: e.teacherId || null,
                monthlyFee: e.monthlyFee ?? 0,
                status: 'active',
              })),
            },
          },
          include: {
            enrollments: {
              include: {
                service: true,
                subject: true,
                level: true,
                teacher: true,
              },
              orderBy: { createdAt: 'asc' },
            },
            level: {
              include: {
                subject: { include: { service: true } },
              },
            },
            teacher: true,
          },
        });

        return student;
      });

      return NextResponse.json(result, { status: 201 });
    } else {
      // Legacy path: no enrollments array, old behavior
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
          enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate) : new Date(),
        },
        include: {
          enrollments: {
            include: {
              service: true,
              subject: true,
              level: true,
              teacher: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          level: {
            include: {
              subject: { include: { service: true } },
            },
          },
          teacher: true,
        },
      });

      return NextResponse.json(student, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}