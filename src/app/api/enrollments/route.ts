import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId query parameter is required' },
        { status: 400 }
      );
    }

    const enrollments = await db.studentEnrollment.findMany({
      where: { studentId },
      include: {
        service: true,
        subject: true,
        level: true,
        teacher: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(enrollments);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrollments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, serviceId, subjectId, levelId, teacherId, monthlyFee } = body;

    if (!studentId || !serviceId) {
      return NextResponse.json(
        { error: 'studentId and serviceId are required' },
        { status: 400 }
      );
    }

    // Check if this is the student's first enrollment
    const existingCount = await db.studentEnrollment.count({
      where: { studentId },
    });

    // Create the enrollment
    const enrollment = await db.studentEnrollment.create({
      data: {
        studentId,
        serviceId,
        subjectId: subjectId || null,
        levelId: levelId || null,
        teacherId: teacherId || null,
        monthlyFee: monthlyFee ?? 0,
        status: 'active',
      },
      include: {
        service: true,
        subject: true,
        level: true,
        teacher: true,
      },
    });

    // If this is the first enrollment, update student for backward compatibility
    if (existingCount === 0) {
      await db.student.update({
        where: { id: studentId },
        data: {
          levelId: levelId || null,
          teacherId: teacherId || null,
          monthlyFee: monthlyFee ?? 0,
        },
      });
    }

    return NextResponse.json(enrollment, { status: 201 });
  } catch (error) {
    console.error('Error creating enrollment:', error);
    return NextResponse.json(
      { error: 'Failed to create enrollment' },
      { status: 500 }
    );
  }
}