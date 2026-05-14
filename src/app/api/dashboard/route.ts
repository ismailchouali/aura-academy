import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── Helper functions (same as teacher-payments API algorithm) ────────────

function getNextMonth(month: number, year: number): { month: number; year: number } {
  if (month === 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

function addMonths(month: number, year: number, n: number): { month: number; year: number } {
  let m = month;
  let y = year;
  for (let i = 0; i < n; i++) {
    const next = getNextMonth(m, y);
    m = next.month;
    y = next.year;
  }
  return { month: m, year: y };
}

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

    // Current month income (always based on current year, regardless of targetYear)
    const currentYearStats = currentYear === targetYear ? monthlyStats : {};
    if (currentYear !== targetYear) {
      // Need to calculate current month stats from current year data
      const currentYearPayments = await db.payment.findMany({
        where: { year: currentYear },
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

      const currentYearMonthly: Record<
        string,
        { revenue: number; expected: number; remaining: number; count: number }
      > = {};

      for (const p of currentYearPayments) {
        const monthNum = monthNameToNumber[p.month] || parseInt(p.month);
        const key = String(monthNum);
        if (!currentYearMonthly[key]) {
          currentYearMonthly[key] = { revenue: 0, expected: 0, remaining: 0, count: 0 };
        }
        const serviceId = p.student?.level?.subject?.serviceId || '';
        const isLangues = serviceId === 'service_langues';
        const pPackMonths = (p.packMonths || 1);
        const divisor = (isLangues && pPackMonths > 1) ? pPackMonths : 1;
        currentYearMonthly[key].revenue += p.paidAmount / divisor;
        currentYearMonthly[key].expected += p.amount / divisor;
        currentYearMonthly[key].remaining += p.remainingAmount / divisor;
        currentYearMonthly[key].count += 1;
      }

      const currentMonthStats = currentYearMonthly[String(currentMonth)] || { revenue: 0, expected: 0, remaining: 0 };
      const monthlyIncome = currentMonthStats.revenue;

      // Calculate teacher expenses for target year
      const { monthlyTeacherExpenses, teacherExpensesTotal } = await calculateTeacherExpenses(targetYear);

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
        teacherPaymentsThisYear: teacherExpensesTotal,
        monthlyTeacherPayments: monthlyTeacherExpenses,
        totalTeacherPayments: (await db.teacherPayment.aggregate({ _sum: { amount: true } }))._sum.amount || 0,
      });
    }

    // Current month income
    const currentMonthStats = monthlyStats[String(currentMonth)] || { revenue: 0, expected: 0, remaining: 0 };
    const monthlyIncome = currentMonthStats.revenue;

    // ─── Teacher expenses: based on student payment coverage algorithm ───
    // Instead of reading TeacherPayment records (which just track when payment was made),
    // we calculate what each teacher EARNED for teaching in each month based on
    // student payment coverage periods.
    //
    // Logic (same as teacher-payments API calculate=true mode):
    // - A student's payment covers packMonths months starting from effectiveStart
    // - effectiveStart = next month if paid on day 1-15, month after next if paid 16-end
    // - Teacher expense for month X = sum of (monthlyAmount × percentage/100)
    //   for all student payments whose coverage includes month X
    const { monthlyTeacherExpenses, teacherExpensesTotal } = await calculateTeacherExpenses(targetYear);

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

    // Total teacher payments (all time - actual payments made)
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
      teacherPaymentsThisYear: teacherExpensesTotal,
      monthlyTeacherPayments: monthlyTeacherExpenses,
      todaySessions,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}

// ─── Calculate teacher expenses for a given year ────────────────────────
// Uses the student payment coverage algorithm to determine what teachers
// earned for teaching in each month of the target year.
async function calculateTeacherExpenses(targetYear: number) {
  // Fetch all active students with their teachers
  const students = await db.student.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      teacherId: true,
      teacher: { select: { id: true, percentage: true } },
    },
  });

  const studentIds = students.map((s) => s.id);

  // Fetch ALL payments for active students (no year filter needed -
  // a pack paid months ago could still be covering months in targetYear)
  let allPayments: Array<{
    studentId: string;
    paidAmount: number;
    packMonths: number;
    paymentDate: Date | null;
  }> = [];

  if (studentIds.length > 0) {
    allPayments = await db.payment.findMany({
      where: {
        studentId: { in: studentIds },
        status: { in: ['paid', 'partial'] },
        paidAmount: { gt: 0 },
      },
      select: {
        studentId: true,
        paidAmount: true,
        packMonths: true,
        paymentDate: true,
      },
    });
  }

  // Build studentId → teacher percentage map
  const studentTeacherPct = new Map<string, number>();
  for (const s of students) {
    if (s.teacherId && s.teacher) {
      studentTeacherPct.set(s.id, s.teacher.percentage || 0);
    }
  }

  // Calculate teacher expense for each month (1-12) of targetYear
  const monthlyTeacherExpenses: Record<string, number> = {};

  for (let monthNum = 1; monthNum <= 12; monthNum++) {
    let totalExpense = 0;

    for (const p of allPayments) {
      const pDate = p.paymentDate ? new Date(p.paymentDate) : null;
      if (!pDate) continue;

      const packMonths = p.packMonths || 1;
      const monthlyAmount = (p.paidAmount || 0) / packMonths;
      const percentage = studentTeacherPct.get(p.studentId) || 0;

      if (percentage <= 0) continue;

      // Determine effective start month based on payment date
      const payMonth = pDate.getMonth() + 1;
      const payYear = pDate.getFullYear();
      const payDay = pDate.getDate();

      let effectiveStart: { month: number; year: number };
      if (payDay >= 1 && payDay <= 15) {
        // Paid 1st-15th → teacher gets paid starting next month
        effectiveStart = getNextMonth(payMonth, payYear);
      } else {
        // Paid 16th-end → teacher gets paid starting month after next
        const next = getNextMonth(payMonth, payYear);
        effectiveStart = getNextMonth(next.month, next.year);
      }

      // Check if targetYear/monthNum falls within this payment's coverage period
      for (let i = 0; i < packMonths; i++) {
        const covered = addMonths(effectiveStart.month, effectiveStart.year, i);
        if (covered.month === monthNum && covered.year === targetYear) {
          const teacherShare = (monthlyAmount * percentage) / 100;
          totalExpense += teacherShare;
          break;
        }
      }
    }

    monthlyTeacherExpenses[String(monthNum)] = Math.round(totalExpense * 100) / 100;
  }

  const teacherExpensesTotal = Object.values(monthlyTeacherExpenses).reduce(
    (sum, val) => sum + val,
    0
  );

  return {
    monthlyTeacherExpenses,
    teacherExpensesTotal: Math.round(teacherExpensesTotal * 100) / 100,
  };
}
