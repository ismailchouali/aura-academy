import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ENROLLMENT_INCLUDE = {
  service: true,
  subject: true,
  level: {
    include: {
      subject: { include: { service: true } },
    },
  },
  teacher: true,
  payments: {
    orderBy: { paymentDate: 'desc' as const },
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const enrollments = await db.studentEnrollment.findMany({
      where: { studentId },
      include: ENROLLMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(enrollments);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.studentId || !body.serviceId) {
      return NextResponse.json(
        { error: 'studentId and serviceId are required' },
        { status: 400 },
      );
    }

    const enrollment = await db.studentEnrollment.create({
      data: {
        studentId: body.studentId,
        serviceId: body.serviceId,
        subjectId: body.subjectId || null,
        levelId: body.levelId || null,
        teacherId: body.teacherId || null,
        monthlyFee: body.monthlyFee ?? 0,
        packMonths: body.packMonths ?? 1,
        enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate) : new Date(),
      },
      include: ENROLLMENT_INCLUDE,
    });

    return NextResponse.json(enrollment, { status: 201 });
  } catch (error) {
    console.error('Error creating enrollment:', error);
    return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
  }
}