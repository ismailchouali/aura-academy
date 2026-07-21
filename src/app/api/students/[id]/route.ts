import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ------------------------------------------------------------------ */
/*  GET /api/students/[id]                                             */
/* ------------------------------------------------------------------ */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const student = await db.student.findUnique({
      where: { id },
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
        enrollments: {
          include: {
            service: true,
            subject: true,
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

/* ------------------------------------------------------------------ */
/*  PUT /api/students/[id]                                             */
/* ------------------------------------------------------------------ */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // --- Update student personal info ---
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
        enrollmentDate: body.enrollmentDate
          ? new Date(body.enrollmentDate)
          : undefined,
      },
      include: {
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
        teacher: true,
        enrollments: {
          include: {
            service: true,
            subject: true,
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
        },
      },
    });

    // --- Sync enrollments if provided in body ---
    if (body.enrollments && Array.isArray(body.enrollments)) {
      const existingIds = new Set(student.enrollments.map((e) => e.id));
      const incomingIds = new Set(
        body.enrollments
          .filter((e: { id?: string }) => e.id)
          .map((e: { id: string }) => e.id),
      );

      // Delete enrollments that were removed
      const toDelete = [...existingIds].filter((eid) => !incomingIds.has(eid));
      if (toDelete.length > 0) {
        await db.studentEnrollment.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // Update or create each incoming enrollment
      for (const e of body.enrollments as Array<{
        id?: string;
        serviceId?: string;
        subjectId?: string | null;
        levelId?: string | null;
        teacherId?: string | null;
        monthlyFee?: number;
        packMonths?: number;
        status?: string;
        enrollmentDate?: string;
      }>) {
        if (e.id) {
          const updateData: Record<string, unknown> = {};
          if (e.serviceId !== undefined) updateData.serviceId = e.serviceId;
          if (e.subjectId !== undefined) updateData.subjectId = e.subjectId;
          if (e.levelId !== undefined) updateData.levelId = e.levelId;
          if (e.teacherId !== undefined) updateData.teacherId = e.teacherId;
          if (e.monthlyFee !== undefined) updateData.monthlyFee = e.monthlyFee;
          if (e.packMonths !== undefined) updateData.packMonths = e.packMonths;
          if (e.status !== undefined) updateData.status = e.status;

          await db.studentEnrollment.update({
            where: { id: e.id },
            data: updateData,
          });
        } else {
          // New enrollment – serviceId is required
          if (!e.serviceId) continue;

          await db.studentEnrollment.create({
            data: {
              studentId: id,
              serviceId: e.serviceId,
              subjectId: e.subjectId || null,
              levelId: e.levelId || null,
              teacherId: e.teacherId || null,
              monthlyFee: e.monthlyFee ?? 0,
              packMonths: e.packMonths ?? 1,
              enrollmentDate: e.enrollmentDate
                ? new Date(e.enrollmentDate)
                : new Date(),
            },
          });
        }
      }

      // Re-fetch to return the final state
      const updated = await db.student.findUnique({
        where: { id },
        include: {
          level: {
            include: {
              subject: { include: { service: true } },
            },
          },
          teacher: true,
          enrollments: {
            include: {
              service: true,
              subject: true,
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
          },
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/students/[id]                                          */
/* ------------------------------------------------------------------ */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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