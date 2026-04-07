import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const totalStudents = await db.student.count();
    const activeStudents = await db.student.count({ where: { status: 'active' } });
    const totalTeachers = await db.teacher.count();
    const activeTeachers = await db.teacher.count({ where: { status: 'active' } });
    const totalClassrooms = await db.classroom.count();
    const totalPayments = await db.payment.count();
    const paidPayments = await db.payment.count({ where: { status: 'paid' } });

    const revenueResult = await db.payment.aggregate({
      _sum: { paidAmount: true, amount: true, remainingAmount: true },
    });

    const totalRevenue = revenueResult._sum.paidAmount || 0;
    const totalExpected = revenueResult._sum.amount || 0;
    const totalRemaining = revenueResult._sum.remainingAmount || 0;

    // Monthly stats for the current year - keyed by month number (1-12)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const monthlyPayments = await db.payment.findMany({
      where: { year: currentYear },
      select: { month: true, paidAmount: true, amount: true, remainingAmount: true },
    });

    // Map English month names to numbers
    const monthNameToNumber: Record<string, number> = {
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
      '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12,
    };

    const monthlyStats: Record<
      string,
      { revenue: number; expected: number; remaining: number; count: number }
    > = {};

    for (const p of monthlyPayments) {
      const monthNum = monthNameToNumber[p.month] || parseInt(p.month);
      const key = String(monthNum);
      if (!monthlyStats[key]) {
        monthlyStats[key] = { revenue: 0, expected: 0, remaining: 0, count: 0 };
      }
      monthlyStats[key].revenue += p.paidAmount;
      monthlyStats[key].expected += p.amount;
      monthlyStats[key].remaining += p.remainingAmount;
      monthlyStats[key].count += 1;
    }

    // Current month income
    const currentMonthStats = monthlyStats[String(currentMonth)] || { revenue: 0, expected: 0, remaining: 0 };
    const monthlyIncome = currentMonthStats.revenue;

    // This year teacher payments total
    const teacherPaymentsThisYear = await db.teacherPayment.aggregate({
      _sum: { amount: true },
      where: { year: currentYear },
    });
    const teacherPaymentsTotal = teacherPaymentsThisYear._sum.amount || 0;

    // Recent payments (last 10)
    const recentPayments = await db.payment.findMany({
      take: 10,
      include: {
        student: {
          include: {
            level: {
              include: {
                subject: {
                  include: { service: true }
                }
              }
            },
            teacher: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Recent students (last 5 enrolled)
    const recentStudents = await db.student.findMany({
      take: 5,
      include: {
        level: {
          include: {
            subject: {
              include: { service: true }
            }
          }
        },
        teacher: true,
      },
      orderBy: { enrollmentDate: 'desc' },
    });

    // Total teacher payments (all time)
    const teacherPaymentStats = await db.teacherPayment.aggregate({
      _sum: { amount: true },
    });

    return NextResponse.json({
      totalStudents,
      activeStudents,
      totalTeachers,
      activeTeachers,
      totalClassrooms,
      totalPayments,
      paidPayments,
      pendingPayments: totalPayments - paidPayments,
      totalRevenue,
      totalExpected,
      totalRemaining,
      monthlyStats,
      monthlyIncome,
      currentYear,
      currentMonth,
      recentPayments,
      recentStudents,
      totalTeacherPayments: teacherPaymentStats._sum.amount || 0,
      teacherPaymentsThisYear: teacherPaymentsTotal,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
