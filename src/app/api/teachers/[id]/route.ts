import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const teacher = await db.teacher.findUnique({
      where: { id },
      include: {
        subjects: {
          include: {
            subject: {
              include: {
                levels: true,
              },
            },
          },
        },
        schedules: {
          include: {
            subject: true,
            classroom: true,
            level: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    return NextResponse.json(teacher);
  } catch (error) {
    console.error('Error fetching teacher:', error);
    return NextResponse.json({ error: 'Failed to fetch teacher' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Handle subjects update: delete existing and create new
    if (body.subjects !== undefined) {
      await db.teacherSubject.deleteMany({ where: { teacherId: id } });
    }

    const teacher = await db.teacher.update({
      where: { id },
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        salary: body.salary,
        percentage: body.percentage,
        notes: body.notes,
        status: body.status,
        subjects: body.subjects
          ? {
              create: body.subjects.map(
                (ts: { subjectId: string; levelIds?: string }) => ({
                  subjectId: ts.subjectId,
                  levelIds: ts.levelIds || '',
                })
              ),
            }
          : undefined,
      },
      include: {
        subjects: {
          include: {
            subject: {
              include: {
                levels: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(teacher);
  } catch (error) {
    console.error('Error updating teacher:', error);
    return NextResponse.json({ error: 'Failed to update teacher' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    await db.teacher.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    return NextResponse.json({ error: 'Failed to delete teacher' }, { status: 500 });
  }
}
