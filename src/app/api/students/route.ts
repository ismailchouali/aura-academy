import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthIndex(month: string): number {
  return MONTH_ORDER.indexOf(month);
}

function toYM(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

function addCalendarMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, day);
  if (result.getDate() !== day) {
    result.setDate(0);
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const levelId = searchParams.get('levelId');
    const teacherId = searchParams.get('teacherId');

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (levelId) {
      where.levelId = levelId;
    }
    if (teacherId) {
      where.teacherId = teacherId;
    }

    const students = await db.student.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
        teacher: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentYM = toYM(now);

    // Calculate payment status for each student
    const enrichedStudents = students.map((student) => {
      const payments = student.payments;
      let isPackPaid = false;
      let nextDueDate: string | null = null;

      if (payments.length > 0) {
        // Find the latest payment by paymentDate
        let latestPayment: typeof payments[0] | null = null;
        let latestDate: Date | null = null;

        for (const p of payments) {
          const pDate = p.paymentDate
            ? (p.paymentDate instanceof Date ? p.paymentDate : new Date(p.paymentDate))
            : new Date(p.year, getMonthIndex(p.month), 1);
          if (!latestDate || pDate >= latestDate) {
            latestDate = pDate;
            latestPayment = p;
          }
        }

        if (latestPayment && latestDate) {
          const dueDate = addCalendarMonths(latestDate, latestPayment.packMonths || 1);
          const day = String(dueDate.getDate()).padStart(2, '0');
          const month = String(dueDate.getMonth() + 1).padStart(2, '0');
          const year = dueDate.getFullYear();
          nextDueDate = `${day}/${month}/${year}`;

          // Pack is considered paid if:
          // 1. The latest payment is fully paid (remainingAmount === 0)
          // 2. The due date hasn't passed yet (today < dueDate)
          if (latestPayment.remainingAmount === 0 && todayDate < dueDate) {
            isPackPaid = true;
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { payments: _payments, ...studentWithoutPayments } = student;

      return {
        ...studentWithoutPayments,
        isPackPaid,
        nextDueDate,
      };
    });

    return NextResponse.json(enrichedStudents);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const student = await db.student.create({
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        levelId: body.levelId || null,
        teacherId: body.teacherId || null,
        parentName: body.parentName,
        parentPhone: body.parentPhone,
        monthlyFee: body.monthlyFee ?? 0,
        packMonths: body.packMonths ?? 1,
        status: body.status || 'active',
        enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate) : new Date(),
      },
      include: {
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
        teacher: true,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}
