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

/**
 * Add N calendar months to a date, keeping the same day of month.
 * JavaScript's Date constructor already clamps to the last day of the month.
 */
function addCalendarMonths(date: Date, months: number): Date {
  const day = date.getDate();
  return new Date(date.getFullYear(), date.getMonth() + months, day);
}

/** Get the effective cycle day for a given month */
function getEffectiveCycleDay(cycleDay: number, year: number, month: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(cycleDay, lastDayOfMonth);
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
    });

    const now = getMoroccoNow();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentYM = toYM(now);

    // Calculate payment status for each student
    const enrichedStudents = students.map((student) => {
      const payments = student.payments;
      const enrollmentDate = student.enrollmentDate
        ? (student.enrollmentDate instanceof Date ? student.enrollmentDate : new Date(student.enrollmentDate))
        : new Date();
      const cycleDay = enrollmentDate.getDate();

      let isPackPaid = false;
      let nextDueDate: string | null = null;

      if (payments.length > 0) {
        // Build set of months covered by fully-paid payments
        const coveredMonths = new Set<number>();
        for (const p of payments) {
          if (p.remainingAmount !== 0) continue;
          const startDate = p.paymentDate
            ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
            : new Date(p.year, getMonthIndex(p.month), 1);
          for (let i = 0; i < (p.packMonths || 1); i++) {
            const coveredDate = addCalendarMonths(startDate, i);
            coveredMonths.add(toYM(coveredDate));
          }
        }

        // Check if current month is covered
        isPackPaid = coveredMonths.has(currentYM);

        // Calculate next due date: first uncovered month's cycle day
        for (let offset = 0; offset <= 60; offset++) {
          const expectedDate = addCalendarMonths(enrollmentDate, offset);
          const monthYM = toYM(expectedDate);
          if (monthYM > currentYM) break;
          if (!coveredMonths.has(monthYM)) {
            const effectiveDay = getEffectiveCycleDay(cycleDay, expectedDate.getFullYear(), expectedDate.getMonth());
            const day = String(effectiveDay).padStart(2, '0');
            const month = String(expectedDate.getMonth() + 1).padStart(2, '0');
            const year = expectedDate.getFullYear();
            nextDueDate = `${day}/${month}/${year}`;
            break;
          }
        }
      }

      const { payments: _payments, ...studentWithoutPayments } = student;

      return {
        ...studentWithoutPayments,
        isPackPaid,
        nextDueDate,
      };
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
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
        teacher: true,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}