import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month);
}

function getMoroccoNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca' }));
}

function toYM(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

function getEffectiveCycleDay(cycleDay: number, year: number, monthIndex: number): number {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(cycleDay, lastDayOfMonth);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || '';

    if (!name) {
      return NextResponse.json({ error: 'Provide ?name= parameter' }, { status: 400 });
    }

    const student = await db.student.findFirst({
      where: {
        fullName: { contains: name, mode: 'insensitive' },
      },
      include: {
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
        teacher: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: `Student "${name}" not found` }, { status: 404 });
    }

    const now = getMoroccoNow();
    const currentYM = toYM(now);

    const enrollmentDate = student.enrollmentDate instanceof Date
      ? student.enrollmentDate
      : new Date(student.enrollmentDate);

    // Simulate buildCoverageSets
    const sortedPaid = student.payments
      .filter((p) => p.remainingAmount === 0)
      .map((p) => ({
        date: p.paymentDate
          ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
          : new Date(p.year, getMonthIndex(p.month), 1),
        packMonths: p.packMonths || 1,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const coveredMonths = new Set<number>();
    let nextOffset = 0;
    for (const payment of sortedPaid) {
      for (let i = 0; i < payment.packMonths && nextOffset < 60; i++) {
        const mi = enrollmentDate.getMonth() + nextOffset;
        const ty = enrollmentDate.getFullYear() + Math.floor(mi / 12);
        const tm = mi % 12;
        coveredMonths.add(ty * 12 + tm);
        nextOffset++;
      }
    }

    const cycleDay = enrollmentDate.getDate();

    // Find next due
    let nextDueInfo: Record<string, unknown> = { result: 'all_covered' };
    for (let offset = 1; offset <= 60; offset++) {
      const monthIndex = enrollmentDate.getMonth() + offset;
      const targetYear = enrollmentDate.getFullYear() + Math.floor(monthIndex / 12);
      const targetMonth = monthIndex % 12;
      const monthYM = targetYear * 12 + targetMonth;
      if (monthYM > currentYM) {
        nextDueInfo = { result: 'future', message: 'No overdue' };
        break;
      }
      if (!coveredMonths.has(monthYM)) {
        const effectiveDay = getEffectiveCycleDay(cycleDay, targetYear, targetMonth);
        nextDueInfo = {
          result: 'overdue',
          dueDate: `${String(effectiveDay).padStart(2, '0')}/${String(targetMonth + 1).padStart(2, '0')}/${targetYear}`,
          month: MONTH_ORDER[targetMonth],
          year: targetYear,
          cycleDay,
          effectiveDay,
          monthYM,
          currentYM,
        };
        break;
      }
    }

    return NextResponse.json({
      student: {
        id: student.id,
        fullName: student.fullName,
        status: student.status,
        monthlyFee: student.monthlyFee,
        enrollmentDate: enrollmentDate.toISOString(),
        enrollmentDay: enrollmentDate.getDate(),
        enrollmentMonth: MONTH_ORDER[enrollmentDate.getMonth()],
        enrollmentYear: enrollmentDate.getFullYear(),
        level: student.level?.nameAr || null,
        subject: student.level?.subject?.nameAr || null,
        service: student.level?.subject?.service?.nameAr || null,
      },
      serverTime: {
        moroccoNow: now.toISOString(),
        currentYM,
      },
      payments: student.payments.map((p) => ({
        id: p.id,
        month: p.month,
        year: p.year,
        amount: p.amount,
        paidAmount: p.paidAmount,
        remainingAmount: p.remainingAmount,
        paymentDate: p.paymentDate?.toISOString() || null,
        packMonths: p.packMonths,
        status: p.status,
        isFullyPaid: p.remainingAmount === 0,
      })),
      coverage: {
        fullyPaidCount: sortedPaid.length,
        coveredMonths: Array.from(coveredMonths).map((ym) => ({
          ym,
          label: `${MONTH_ORDER[ym % 12]} ${Math.floor(ym / 12)}`,
        })),
        nextDue: nextDueInfo,
      },
    });
  } catch (error) {
    console.error('Debug student error:', error);
    return NextResponse.json({ error: 'Failed', details: String(error) }, { status: 500 });
  }
}