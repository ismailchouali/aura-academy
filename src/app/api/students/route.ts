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
      let isPackPaid = false;
      let nextDueDate: string | null = null;

      if (payments.length > 0) {
        const enrollmentDate = student.enrollmentDate
          ? (student.enrollmentDate instanceof Date ? student.enrollmentDate : new Date(student.enrollmentDate))
          : new Date();
        const cycleDay = enrollmentDate.getDate();

        // Build covered months using queue-based Logic A (fixed cycle day from enrollment)
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

        // Month-field-based: also cover months from the payment's month/year field
        for (const p of payments) {
          if (p.remainingAmount === 0) {
            for (let i = 0; i < (p.packMonths || 1); i++) {
              const mi = getMonthIndex(p.month) + i;
              const ty = p.year + Math.floor(mi / 12);
              const tm = mi % 12;
              coveredMonths.add(ty * 12 + tm);
            }
          }
        }

        // isPackPaid: current month is covered
        isPackPaid = coveredMonths.has(currentYM);

        // nextDueDate: first uncovered month using FIXED cycle day
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
