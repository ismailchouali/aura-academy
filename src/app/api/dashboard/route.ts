import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request?: NextRequest) {
  try {
    // Support optional year query parameter (for financial reports cross-year filtering)
    let targetYear = new Date().getFullYear();
    if (request) {
      const { searchParams } = new URL(request.url);
      const yearParam = searchParams.get('year');
      if (yearParam) {
        const parsed = parseInt(yearParam);
        if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2099) {
          targetYear = parsed;
        }
      }
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12

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

    // ─── Monthly revenue stats for the target year ──────────────────────
    const monthlyPayments = await db.payment.findMany({
      where: { year: targetYear },
      select: {
        month: true,
        paidAmount: true,
        amount: true,
        remainingAmount: true,
        packMonths: true,
        student: {
          select: {
            level: {
              select: {
                subject: {
                  select: {
                    serviceId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

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
      // For Langues service with packMonths > 1, use monthly equivalent
      const serviceId = p.student?.level?.subject?.serviceId || '';
      const isLangues = serviceId === 'service_langues';
      const packMonths = (p.packMonths || 1);
      const divisor = (isLangues && packMonths > 1) ? packMonths : 1;
      monthlyStats[key].revenue += p.paidAmount / divisor;
      monthlyStats[key].expected += p.amount / divisor;
      monthlyStats[key].remaining += p.remainingAmount / divisor;
      monthlyStats[key].count += 1;
    }

    // ─── Teacher expenses: from TeacherPayment records ──────────────────
    // Read actual amounts paid to teachers, grouped by month.
    // The "month" field on TeacherPayment = the month the expense belongs to
    // (the month the teacher worked, NOT the month the physical payment happened).
    const teacherPaymentsThisYearResult = await db.teacherPayment.aggregate({
      _sum: { amount: true },
      where: { year: targetYear },
    });
    const teacherPaymentsTotal = teacherPaymentsThisYearResult._sum.amount || 0;

    const monthlyTeacherPaymentsData = await db.teacherPayment.findMany({
      where: { year: targetYear },
      select: { month: true, amount: true },
    });
    const monthlyTeacherPayments: Record<string, number> = {};
    for (const tp of monthlyTeacherPaymentsData) {
      const monthNum = monthNameToNumber[tp.month] || parseInt(tp.month);
      const key = String(monthNum);
      monthlyTeacherPayments[key] = (monthlyTeacherPayments[key] || 0) + tp.amount;
    }

    // Current month income (always based on current year, regardless of targetYear)
    let monthlyIncome = 0;
    if (currentYear === targetYear) {
      const currentMonthStats = monthlyStats[String(currentMonth)] || { revenue: 0, expected: 0, remaining: 0 };
      monthlyIncome = currentMonthStats.revenue;
    } else {
      const currentYearPayments = await db.payment.findMany({
        where: { year: currentYear, month: String(currentMonth) },
        select: {
          paidAmount: true,
          packMonths: true,
          student: {
            select: {
              level: {
                select: {
                  subject: {
                    select: { serviceId: true },
                  },
                },
              },
            },
          },
        },
      });

      let revenue = 0;
      for (const p of currentYearPayments) {
        const serviceId = p.student?.level?.subject?.serviceId || '';
        const isLangues = serviceId === 'service_langues';
        const pPackMonths = (p.packMonths || 1);
        const divisor = (isLangues && pPackMonths > 1) ? pPackMonths : 1;
        revenue += p.paidAmount / divisor;
      }
      monthlyIncome = revenue;
    }

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

    // Today's sessions
    const jsDay = new Date().getDay();
    const scheduleDayOfWeek = jsDay === 0 ? '1' : String(jsDay + 1);

    const todaySessions = await db.schedule.findMany({
      where: {
        dayOfWeek: scheduleDayOfWeek,
        OR: [
          { sessionType: 'fixed' },
          { sessionType: 'trial', trialDate: { gte: new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca' })) } },
          { sessionType: 'trial', trialDate: null },
        ],
      },
      include: {
        subject: {
          include: {
            service: true,
          },
        },
        teacher: true,
        classroom: true,
        level: true,
      },
      orderBy: { startTime: 'asc' },
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
      monthlyTeacherPayments,
      todaySessions,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
