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

    // Monthly stats for the current year
    const currentYear = new Date().getFullYear();
    const monthlyPayments = await db.payment.findMany({
      where: { year: currentYear },
      select: { month: true, paidAmount: true, amount: true, remainingAmount: true },
    });

    const monthlyStats: Record<
      string,
      { revenue: number; expected: number; remaining: number; count: number }
    > = {};

    for (const p of monthlyPayments) {
      if (!monthlyStats[p.month]) {
        monthlyStats[p.month] = { revenue: 0, expected: 0, remaining: 0, count: 0 };
      }
      monthlyStats[p.month].revenue += p.paidAmount;
      monthlyStats[p.month].expected += p.amount;
      monthlyStats[p.month].remaining += p.remainingAmount;
      monthlyStats[p.month].count += 1;
    }

    // Recent payments (last 10)
    const recentPayments = await db.payment.findMany({
      take: 10,
      include: { student: true },
      orderBy: { createdAt: 'desc' },
    });

    // Teacher payment stats
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
      recentPayments,
      totalTeacherPayments: teacherPaymentStats._sum.amount || 0,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
