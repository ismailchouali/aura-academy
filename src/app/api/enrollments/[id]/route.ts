import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build update data with only provided fields
    const data: Record<string, unknown> = {};
    if (body.subjectId !== undefined) data.subjectId = body.subjectId || null;
    if (body.levelId !== undefined) data.levelId = body.levelId || null;
    if (body.teacherId !== undefined) data.teacherId = body.teacherId || null;
    if (body.monthlyFee !== undefined) data.monthlyFee = body.monthlyFee;
    if (body.status !== undefined) data.status = body.status;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const enrollment = await db.studentEnrollment.update({
      where: { id },
      data,
      include: {
        service: true,
        subject: true,
        level: true,
        teacher: true,
      },
    });

    return NextResponse.json(enrollment);
  } catch (error) {
    console.error('Error updating enrollment:', error);
    return NextResponse.json(
      { error: 'Failed to update enrollment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the enrollment with student info before deleting
    const enrollment = await db.studentEnrollment.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Check if this is the student's primary enrollment
    const isPrimary = enrollment.student.levelId === enrollment.levelId;

    // Delete the enrollment
    await db.studentEnrollment.delete({ where: { id } });

    // If it was the primary enrollment, clear the student's legacy fields
    if (isPrimary) {
      await db.student.update({
        where: { id: enrollment.studentId },
        data: {
          levelId: null,
          teacherId: null,
          monthlyFee: 0,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    return NextResponse.json(
      { error: 'Failed to delete enrollment' },
      { status: 500 }
    );
  }
}