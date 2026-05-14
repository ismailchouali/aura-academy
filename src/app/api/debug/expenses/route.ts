import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Diagnostic endpoint - REMOVE after debugging
export async function GET() {
  try {
    const year = 2026;

    // Get all payments for April and May 2026 with teacher info
    const payments = await db.payment.findMany({
      where: { year },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            teacherId: true,
            teacher: { select: { id: true, fullName: true, percentage: true } },
            level: {
              select: {
                name: true,
                subject: {
                  select: { serviceId: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { month: 'asc' },
    });

    const monthNameToNumber: Record<string, number> = {
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
      '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12,
    };

    // Build monthly summary
    const months: Record<string, {
      revenue: number;
      payments: Array<{
        studentName: string;
        paidAmount: number;
        packMonths: number;
        teacherName: string | null;
        teacherPct: number | null;
        teacherId: string | null;
        serviceId: string;
        month: string;
      }>;
    }> = {};

    for (const p of payments) {
      const monthNum = monthNameToNumber[p.month] || parseInt(p.month);
      const key = String(monthNum);

      if (!months[key]) {
        months[key] = { revenue: 0, payments: [] };
      }

      const serviceId = p.student?.level?.subject?.serviceId || '';
      const isLangues = serviceId === 'service_langues';
      const packMonths = p.packMonths || 1;
      const divisor = (isLangues && packMonths > 1) ? packMonths : 1;
      months[key].revenue += (p.paidAmount || 0) / divisor;

      months[key].payments.push({
        studentName: p.student?.fullName || 'Unknown',
        paidAmount: p.paidAmount || 0,
        packMonths: p.packMonths || 1,
        teacherName: p.student?.teacher?.fullName || null,
        teacherPct: p.student?.teacher?.percentage ?? null,
        teacherId: p.student?.teacherId || null,
        serviceId,
        month: p.month,
      });
    }

    // Calculate expenses per month
    const expenses: Record<string, { total: number; breakdown: Array<{ teacher: string; amount: number }> }> = {};

    for (const [monthKey, monthData] of Object.entries(months)) {
      let totalExpense = 0;
      const breakdown: Array<{ teacher: string; amount: number }> = [];

      for (const p of monthData.payments) {
        if (p.teacherPct && p.teacherPct > 0) {
          const serviceId = p.serviceId;
          const isLangues = serviceId === 'service_langues';
          const packMonths = p.packMonths;
          const divisor = (isLangues && packMonths > 1) ? packMonths : 1;
          const monthlyAmount = p.paidAmount / divisor;
          const share = (monthlyAmount * p.teacherPct) / 100;
          totalExpense += share;

          const existing = breakdown.find(b => b.teacher === (p.teacherName || 'Unknown'));
          if (existing) {
            existing.amount += share;
          } else {
            breakdown.push({ teacher: p.teacherName || 'Unknown', amount: share });
          }
        }
      }

      expenses[monthKey] = { total: Math.round(totalExpense * 100) / 100, breakdown };
    }

    return NextResponse.json({ months, expenses });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
