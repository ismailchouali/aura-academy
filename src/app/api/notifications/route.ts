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

// GET /api/notifications — List all notifications (unread first)
export async function GET() {
  try {
    const notifications = await db.notification.findMany({
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// POST /api/notifications — Generate notifications automatically
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action === 'generate') {
      return generateNotifications();
    }

    if (action === 'mark-all-read') {
      await db.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST notifications:', error);
    return NextResponse.json(
      { error: 'Failed to process notification request' },
      { status: 500 }
    );
  }
}

async function generateNotifications() {
  const now = new Date();
  const currentMonthName = MONTH_ORDER[now.getMonth()];
  const currentYear = now.getFullYear();
  const curYearMonth = currentYear * 12 + now.getMonth();

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

  const newNotifications: Array<{
    type: string;
    title: string;
    message: string;
    studentId: string;
    studentName: string;
    amount: number;
    month: string;
    year: number;
  }> = [];

  for (const student of students) {
    const serviceId = student.level?.subject?.service?.id || '';
    const serviceName = student.level?.subject?.service?.nameAr || '';
    const levelName = student.level?.nameAr || '';
    const isLangues = serviceId === 'service_langues';
    const packMonths = student.packMonths || 1;

    // ── Check if covered by a pack (Langues service only) ──
    if (isLangues && packMonths > 1) {
      const packPayment = student.payments.find(
        (p) => p.packMonths > 1 && p.year === currentYear
      );

      if (packPayment && packPayment.paymentDate) {
        const pDate = new Date(packPayment.paymentDate);
        const payYearMonth = pDate.getFullYear() * 12 + pDate.getMonth();
        const monthsSincePayment = Math.max(0, curYearMonth - payYearMonth);

        if (monthsSincePayment < packMonths) {
          continue; // Still covered by the pack
        } else if (monthsSincePayment === packMonths) {
          // Pack just expired this month
          newNotifications.push({
            type: 'payment_overdue',
            title: 'انتهاء باك الاشتراك',
            message: `انتهت فترة باك ${packMonths} أشهر لتلميد(ة) ${student.fullName} (${serviceName} - ${levelName}). المبلغ المستحق: ${student.monthlyFee} درهم`,
            studentId: student.id,
            studentName: student.fullName,
            amount: student.monthlyFee,
            month: currentMonthName,
            year: currentYear,
          });
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
      newNotifications.push({
        type: 'unpaid_this_month',
        title: 'قسط شهر لم يسدد',
        message: `لم يسدد(ي) التلميد(ة) ${student.fullName} (${serviceName} - ${levelName}) قسط شهر ${MONTH_LABELS[currentMonthName]} ${currentYear}. المبلغ: ${student.monthlyFee} درهم`,
        studentId: student.id,
        studentName: student.fullName,
        amount: student.monthlyFee,
        month: currentMonthName,
        year: currentYear,
      });
    }

    // ── Check for overdue payments (more than 1 month) ──
    for (const p of student.payments) {
      if (p.remainingAmount <= 0) continue;

      let overdueMonths = 0;

      if (isLangues && p.packMonths > 1 && p.paymentDate) {
        const pDate = new Date(p.paymentDate);
        const payYearMonth = pDate.getFullYear() * 12 + pDate.getMonth();
        const monthsSincePayment = Math.max(0, curYearMonth - payYearMonth);
        overdueMonths = Math.max(0, monthsSincePayment - (p.packMonths - 1));
      } else {
        const mIdx = getMonthIndex(p.month);
        const paymentYearMonth = p.year * 12 + mIdx;
        overdueMonths = Math.max(0, curYearMonth - paymentYearMonth);
      }

      if (overdueMonths >= 1) {
        // Check if we already have a notification for this student+month+year
        const existing = await db.notification.findFirst({
          where: {
            studentId: student.id,
            type: 'payment_overdue',
            month: p.month,
            year: p.year,
          },
        });

        if (!existing) {
          newNotifications.push({
            type: 'payment_overdue',
            title: `قسط متأخر (${overdueMonths} أشهر)`,
            message: `التلميد(ة) ${student.fullName} (${serviceName} - ${levelName}) عليه(ها) قسط متأخر لشهر ${MONTH_LABELS[p.month]} ${p.year}. المبلغ المتبقي: ${p.remainingAmount} درهم - التأخير: ${overdueMonths} أشهر`,
            studentId: student.id,
            studentName: student.fullName,
            amount: p.remainingAmount,
            month: p.month,
            year: p.year,
          });
        }
      }
    }
  }

  // Delete old notifications of the same type/month/year that are not in the new list
  // (cleanup stale notifications for students who may have paid)
  // We only delete old "unpaid_this_month" notifications for previous months
  if (newNotifications.length > 0 || true) {
    // Clean up old unread_this_month notifications from previous months
    await db.notification.deleteMany({
      where: {
        type: 'unpaid_this_month',
        OR: [
          { year: { lt: currentYear } },
          {
            year: currentYear,
            month: { not: currentMonthName },
          },
        ],
      },
    });
  }

  // Insert new notifications (deduplicated)
  let createdCount = 0;
  for (const notif of newNotifications) {
    // Dedup: don't create if same type+student+month+year already exists
    const existing = await db.notification.findFirst({
      where: {
        type: notif.type,
        studentId: notif.studentId,
        month: notif.month,
        year: notif.year,
      },
    });

    if (!existing) {
      await db.notification.create({
        data: notif,
      });
      createdCount++;
    }
  }

  const totalUnread = await db.notification.count({
    where: { isRead: false },
  });

  return NextResponse.json({
    success: true,
    generated: createdCount,
    totalUnread,
    totalChecked: students.length,
  });
}
