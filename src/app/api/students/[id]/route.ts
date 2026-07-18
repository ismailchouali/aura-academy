import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const student = await db.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
            service: true,
            subject: true,
            level: true,
            teacher: true,
          },
          orderBy: { createdAt: 'asc' },
        },
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

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const enrollmentsData: Array<{
      serviceId: string;
      subjectId?: string;
      levelId?: string;
      teacherId?: string;
      monthlyFee?: number;
    }> | undefined = body.enrollments;

    if (enrollmentsData && enrollmentsData.length > 0) {
      // New multi-enrollment path: use transaction to replace all enrollments
      const firstEnrollment = enrollmentsData[0];

      const result = await db.$transaction(async (tx) => {
        // Delete all existing enrollments for this student
        await tx.studentEnrollment.deleteMany({
          where: { studentId: id },
        });

        // Update student + create new enrollments
        const student = await tx.student.update({
          where: { id },
          data: {
            fullName: body.fullName,
            phone: body.phone,
            email: body.email,
            address: body.address,
            levelId: firstEnrollment.levelId || null,
            teacherId: firstEnrollment.teacherId || null,
            parentName: body.parentName,
            parentPhone: body.parentPhone,
            monthlyFee: firstEnrollment.monthlyFee ?? 0,
            packMonths: body.packMonths ?? 1,
            status: body.status,
            enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate) : undefined,
            enrollments: {
              create: enrollmentsData.map((e) => ({
                serviceId: e.serviceId,
                subjectId: e.subjectId || null,
                levelId: e.levelId || null,
                teacherId: e.teacherId || null,
                monthlyFee: e.monthlyFee ?? 0,
                status: 'active',
              })),
            },
          },
          include: {
            enrollments: {
              include: {
                service: true,
                subject: true,
                level: true,
                teacher: true,
              },
              orderBy: { createdAt: 'asc' },
            },
            level: {
              include: {
                subject: { include: { service: true } },
              },
            },
            teacher: true,
          },
        });

        return student;
      });

      return NextResponse.json(result);
    } else {
      // Legacy path: no enrollments array, old behavior
      const student = await db.student.update({
        where: { id },
        data: {
          fullName: body.fullName,
          phone: body.phone,
          email: body.email,
          address: body.address,
          levelId: body.levelId,
          teacherId: body.teacherId,
          parentName: body.parentName,
          parentPhone: body.parentPhone,
          monthlyFee: body.monthlyFee ?? 0,
          packMonths: body.packMonths ?? 1,
          status: body.status,
          enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate) : undefined,
        },
        include: {
          enrollments: {
            include: {
              service: true,
              subject: true,
              level: true,
              teacher: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          level: {
            include: {
              subject: { include: { service: true } },
            },
          },
          teacher: true,
        },
      });

      return NextResponse.json(student);
    }
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.student.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
  }
}