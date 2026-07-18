import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const serviceId = searchParams.get('serviceId');
    const subjectId = searchParams.get('subjectId');
    const levelId = searchParams.get('levelId');

    const where: Record<string, unknown> = {};

    if (studentId) {
      where.studentId = studentId;
    }
    if (month) {
      where.month = month;
    }
    if (year) {
      where.year = parseInt(year);
    }
    if (status) {
      where.status = status;
    }

    // Filter by service/subject/level through student relation
    if (serviceId || subjectId || levelId) {
      const studentFilter: Record<string, unknown> = {};
      if (levelId) {
        studentFilter.levelId = levelId;
      } else if (subjectId) {
        studentFilter.level = { subjectId };
      } else if (serviceId) {
        studentFilter.level = { subject: { serviceId } };
      }
      where.student = studentFilter;
    }

    const payments = await db.payment.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
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
      orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payment = await db.payment.create({
      data: {
        studentId: body.studentId,
        amount: body.amount,
        paidAmount: body.paidAmount || 0,
        remainingAmount: body.remainingAmount ?? body.amount - (body.discount || 0) - (body.paidAmount || 0),
        month: body.month,
        year: body.year,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
        discount: body.discount || 0,
        packMonths: body.packMonths || 1,
        method: body.method,
        notes: body.notes,
        status: body.status || 'pending',
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
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
