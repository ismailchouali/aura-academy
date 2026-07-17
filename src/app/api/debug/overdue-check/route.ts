import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** Get current date/time in Africa/Casablanca timezone */
function getMoroccoNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca' }));
}

function toYM(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || '';

    const students = await db.student.findMany({
      where: name ? { fullName: { contains: name } } : undefined,
      include: {
        payments: true,
        level: { include: { subject: { include: { service: true } } } },
      },
    });

    const now = getMoroccoNow();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentYM = toYM(now);

    const debug = students.map(s => {
      const enrollmentDate = s.enrollmentDate instanceof Date
        ? s.enrollmentDate : new Date(s.enrollmentDate);
      const cycleDay = enrollmentDate.getDate();
      const enrollmentYM = toYM(enrollmentDate);

      // Queue-based coverage
      const sortedPaid = s.payments
        .filter(p => p.remainingAmount === 0)
        .map(p => ({
          date: p.paymentDate ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate)) : new Date(p.year, getMonthIndex(p.month), 1),
          packMonths: p.packMonths || 1,
          id: p.id,
          month: p.month,
          year: p.year,
          paymentDateStr: p.paymentDate?.toString() || null,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      const coveredMonths: number[] = [];
      let nextCycleOffset = 0;
      for (const payment of sortedPaid) {
        for (let i = 0; i < payment.packMonths && nextCycleOffset < 60; i++) {
          const mi = enrollmentDate.getMonth() + nextCycleOffset;
          const ty = enrollmentDate.getFullYear() + Math.floor(mi / 12);
          const tm = mi % 12;
          coveredMonths.push(ty * 12 + tm);
          nextCycleOffset++;
        }
      }

      // Find next due
      let nextDueDate: string | null = null;
      let nextDueDateObj: Date | null = null;
      for (let offset = 1; offset <= 60; offset++) {
        const mi = enrollmentDate.getMonth() + offset;
        const ty = enrollmentDate.getFullYear() + Math.floor(mi / 12);
        const tm = mi % 12;
        const ym = ty * 12 + tm;
        if (ym > currentYM) break;
        if (!coveredMonths.includes(ym)) {
          const lastDay = new Date(ty, tm + 1, 0).getDate();
          const effDay = Math.min(cycleDay, lastDay);
          nextDueDateObj = new Date(ty, tm, effDay);
          nextDueDate = `${String(effDay).padStart(2,'0')}/${String(tm+1).padStart(2,'0')}/${ty}`;
          break;
        }
      }

      const isOverdue = nextDueDateObj ? todayDate >= nextDueDateObj : false;

      return {
        name: s.fullName,
        status: s.status,
        levelId: s.levelId,
        levelName: s.level?.nameAr || null,
        subjectName: s.level?.subject?.nameAr || null,
        serviceName: s.level?.subject?.service?.nameAr || null,
        enrollmentDate: enrollmentDate.toISOString(),
        enrollmentYM,
        cycleDay,
        currentYM,
        todayDate: todayDate.toISOString(),
        moroccoNow: now.toISOString(),
        payments: s.payments.map(p => ({
          id: p.id,
          month: p.month,
          year: p.year,
          amount: p.amount,
          paidAmount: p.paidAmount,
          remainingAmount: p.remainingAmount,
          packMonths: p.packMonths,
          paymentDate: p.paymentDate?.toISOString() || null,
          status: p.status,
        })),
        sortedPaidQueue: sortedPaid,
        coveredMonths,
        nextDueDate,
        nextDueDateObj: nextDueDateObj?.toISOString() || null,
        todayDateCheck: isOverdue ? 'OVERDUE (todayDate >= nextDueDate)' : 'NOT overdue',
        totalPayments: s.payments.length,
        paidPayments: s.payments.filter(p => p.remainingAmount === 0).length,
        unpaidPayments: s.payments.filter(p => p.remainingAmount > 0).length,
      };
    });

    return NextResponse.json({
      debug: true,
      timestamp: new Date().toISOString(),
      moroccoTime: now.toISOString(),
      students: debug,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}