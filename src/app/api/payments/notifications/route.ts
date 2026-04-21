import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month);
}

export async function GET() {
  try {
    const now = new Date();
    const currentMonthName = MONTH_ORDER[now.getMonth()]; // e.g. "January"
    const currentYear = now.getFullYear();

    // Fetch all active students with their related data
    const students = await db.student.findMany({
      where: { status: 'active' },
      include: {
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
        teacher: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const unpaidThisMonth: Array<{
      studentId: string;
      studentName: string;
      phone: string | null;
      parentPhone: string | null;
      parentName: string | null;
      monthlyFee: number;
      service: string;
      level: string;
      teacher: string;
      enrollmentDate: string;
    }> = [];

    const overdueStudents: Array<{
      studentId: string;
      studentName: string;
      phone: string | null;
      parentPhone: string | null;
      monthlyFee: number;
      service: string;
      level: string;
      totalRemaining: number;
      monthsOverdue: number;
    }> = [];

    const curYearMonth = currentYear * 12 + now.getMonth(); // 0-indexed month

    for (const student of students) {
      const serviceId = student.level?.subject?.service?.id || '';
      const serviceName = student.level?.subject?.service?.nameAr || '';
      const levelName = student.level?.nameAr || '';
      const teacherName = student.teacher?.fullName || '';
      const isLangues = serviceId === 'service_langues';
      const packMonths = student.packMonths || 1;

      // ── Check if covered by a pack (Langues service only) ──
      if (isLangues && packMonths > 1) {
        // Find the most recent payment for this year with packMonths > 1
        const packPayment = student.payments.find(
          (p) => p.packMonths > 1 && p.year === currentYear
        );

        if (packPayment && packPayment.paymentDate) {
          const pDate = new Date(packPayment.paymentDate);
          const payYearMonth = pDate.getFullYear() * 12 + pDate.getMonth();
          const monthsSincePayment = Math.max(0, curYearMonth - payYearMonth);

          if (monthsSincePayment < packMonths) {
            // Still covered by the pack — skip unpaid check
            continue;
          }
        }
      }

      // ── Check if student has a paid payment for current month ──
      const hasPaidThisMonth = student.payments.some((p) => {
        if (p.month !== currentMonthName || p.year !== currentYear) return false;
        const requiredAmount = p.amount - (p.discount || 0);
        return p.status === 'paid' || p.paidAmount >= requiredAmount;
      });

      if (!hasPaidThisMonth) {
        unpaidThisMonth.push({
          studentId: student.id,
          studentName: student.fullName,
          phone: student.phone || null,
          parentPhone: student.parentPhone || null,
          parentName: student.parentName || null,
          monthlyFee: student.monthlyFee,
          service: serviceName,
          level: levelName,
          teacher: teacherName,
          enrollmentDate: student.enrollmentDate.toISOString().split('T')[0],
        });
      }

      // ── Check for overdue payments ──
      let totalRemaining = 0;
      let maxMonthsOverdue = 0;

      for (const p of student.payments) {
        if (p.remainingAmount <= 0) continue;

        // For Langues pack: use paymentDate
        if (isLangues && p.packMonths > 1 && p.paymentDate) {
          const pDate = new Date(p.paymentDate);
          const payYearMonth = pDate.getFullYear() * 12 + pDate.getMonth();
          const monthsSincePayment = Math.max(0, curYearMonth - payYearMonth);
          const overdueMonths = Math.max(0, monthsSincePayment - (p.packMonths - 1));
          if (overdueMonths >= 1) {
            totalRemaining += p.remainingAmount;
            maxMonthsOverdue = Math.max(maxMonthsOverdue, overdueMonths);
          }
        } else {
          // Default: use month/year fields
          const mIdx = getMonthIndex(p.month);
          const paymentYearMonth = p.year * 12 + mIdx;
          const overdueMonths = Math.max(0, curYearMonth - paymentYearMonth);
          if (overdueMonths >= 1) {
            totalRemaining += p.remainingAmount;
            maxMonthsOverdue = Math.max(maxMonthsOverdue, overdueMonths);
          }
        }
      }

      if (totalRemaining > 0) {
        overdueStudents.push({
          studentId: student.id,
          studentName: student.fullName,
          phone: student.phone || null,
          parentPhone: student.parentPhone || null,
          monthlyFee: student.monthlyFee,
          service: serviceName,
          level: levelName,
          totalRemaining,
          monthsOverdue: maxMonthsOverdue,
        });
      }
    }

    return NextResponse.json({
      unpaidThisMonth,
      overdueStudents,
      totalCount: unpaidThisMonth.length,
      overdueCount: overdueStudents.length,
    });
  } catch (error) {
    console.error('Error fetching payment notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment notifications' },
      { status: 500 }
    );
  }
}
