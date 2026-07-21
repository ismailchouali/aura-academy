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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const enrollment = await db.studentEnrollment.findUnique({
      where: { id },
      include: ENROLLMENT_INCLUDE,
    });

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    return NextResponse.json(enrollment);
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    return NextResponse.json({ error: 'Failed to fetch enrollment' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build update data – only include fields that are explicitly provided
    const data: Record<string, unknown> = {};
    if (body.serviceId !== undefined) data.serviceId = body.serviceId;
    if (body.subjectId !== undefined) data.subjectId = body.subjectId;
    if (body.levelId !== undefined) data.levelId = body.levelId;
    if (body.teacherId !== undefined) data.teacherId = body.teacherId;
    if (body.monthlyFee !== undefined) data.monthlyFee = body.monthlyFee;
    if (body.packMonths !== undefined) data.packMonths = body.packMonths;
    if (body.status !== undefined) data.status = body.status;

    const enrollment = await db.studentEnrollment.update({
      where: { id },
      data,
      include: ENROLLMENT_INCLUDE,
    });

    return NextResponse.json(enrollment);
  } catch (error) {
    console.error('Error updating enrollment:', error);
    return NextResponse.json({ error: 'Failed to update enrollment' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    await db.studentEnrollment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    return NextResponse.json({ error: 'Failed to delete enrollment' }, { status: 500 });
  }
}