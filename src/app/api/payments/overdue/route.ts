import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_LABELS: Record<string, string> = {
  January: 'يناير', February: 'فبراير', March: 'مارس', April: 'أبريل',
  May: 'ماي', June: 'يونيو', July: 'يوليوز', August: 'غشت',
  September: 'شتنبر', October: 'أكتوبر', November: 'نونبر', December: 'دجنبر',
};

function getMonthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month);
}

function countMonthsOverdue(month: string, year: number): number {
  const mIdx = getMonthIndex(month);
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed
  const paymentYM = year * 12 + mIdx;
  const currentYM = curYear * 12 + curMonth;
  return Math.max(0, currentYM - paymentYM);
}

function isOverdue(month: string, year: number): boolean {
  return countMonthsOverdue(month, year) >= 1;
}

export async function GET() {
  try {
    // Fetch all payments with remaining amount > 0
    const payments = await db.payment.findMany({
      where: {
        remainingAmount: { gt: 0 },
      },
      include: {
        student: {
          include: {
            level: {
              include: {
                subject: { include: { service: true } },
              },
            },
            teacher: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to only overdue payments (payment month is at least 1 month in the past)
    const overduePayments = payments.filter(
      (p) => isOverdue(p.month, p.year)
    );

    // Group by service → level → student
    const serviceMap = new Map<string, Map<string, Map<string, typeof overduePayments>>>();

    for (const p of overduePayments) {
      const serviceName = p.student.level?.subject?.service?.nameAr || 'بدون خدمة';
      const levelName = p.student.level?.nameAr || 'بدون مستوى';
      const studentKey = p.studentId;

      if (!serviceMap.has(serviceName)) serviceMap.set(serviceName, new Map());
      const levelMap = serviceMap.get(serviceName)!;
      if (!levelMap.has(levelName)) levelMap.set(levelName, new Map());
      const studentMap = levelMap.get(levelName)!;
      if (!studentMap.has(studentKey)) studentMap.set(studentKey, []);
      studentMap.get(studentKey)!.push(p);
    }

    // Build response
    const result = Array.from(serviceMap.entries()).map(([service, levelMap]) => {
      const levels = Array.from(levelMap.entries()).map(([level, studentMap]) => {
        const students = Array.from(studentMap.entries()).map(([, payments]) => {
          const student = payments[0].student;
          const totalOverdue = payments.reduce((s, p) => s + p.remainingAmount, 0);
          const maxMonthsOverdue = Math.max(
            ...payments.map((p) => countMonthsOverdue(p.month, p.year))
          );

          return {
            studentId: student.id,
            studentName: student.fullName,
            phone: student.phone || null,
            parentPhone: student.parentPhone || null,
            parentName: student.parentName || null,
            monthlyFee: student.monthlyFee,
            totalOverdue,
            monthsOverdue: maxMonthsOverdue,
            paymentCount: payments.length,
            overduePayments: payments.map((p) => ({
              id: p.id,
              month: p.month,
              monthLabel: MONTH_LABELS[p.month] || p.month,
              year: p.year,
              remainingAmount: p.remainingAmount,
              monthsOverdue: countMonthsOverdue(p.month, p.year),
            })),
          };
        });

        const totalLevelOverdue = students.reduce((s, st) => s + st.totalOverdue, 0);

        return {
          level,
          students,
          totalOverdue: totalLevelOverdue,
          studentCount: students.length,
        };
      });

      const totalServiceOverdue = levels.reduce((s, l) => s + l.totalOverdue, 0);
      const totalStudentCount = levels.reduce((s, l) => s + l.studentCount, 0);

      return {
        service,
        levels,
        totalOverdue: totalServiceOverdue,
        studentCount: totalStudentCount,
      };
    });

    // Sort services by total overdue (descending)
    result.sort((a, b) => b.totalOverdue - a.totalOverdue);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching overdue payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overdue payments' },
      { status: 500 }
    );
  }
}
