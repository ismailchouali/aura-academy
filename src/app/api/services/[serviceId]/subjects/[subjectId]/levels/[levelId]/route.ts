import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; subjectId: string; levelId: string }> }
) {
  try {
    const { serviceId, subjectId, levelId } = await params;
    const body = await request.json();
    const { name, nameAr, nameFr } = body;

    // Verify the level belongs to the subject and service
    const existing = await db.level.findFirst({
      where: { id: levelId, subjectId },
      include: { subject: { select: { serviceId: true } } },
    });
    if (!existing || existing.subject.serviceId !== serviceId) {
      return NextResponse.json({ error: 'Level not found' }, { status: 404 });
    }

    const level = await db.level.update({
      where: { id: levelId },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameFr !== undefined && { nameFr }),
      },
    });

    return NextResponse.json(level);
  } catch (error) {
    console.error('Error updating level:', error);
    return NextResponse.json({ error: 'Failed to update level' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; subjectId: string; levelId: string }> }
) {
  try {
    const { serviceId, subjectId, levelId } = await params;

    // Verify the level belongs to the subject and service
    const existing = await db.level.findFirst({
      where: { id: levelId, subjectId },
      include: { subject: { select: { serviceId: true } } },
    });
    if (!existing || existing.subject.serviceId !== serviceId) {
      return NextResponse.json({ error: 'Level not found' }, { status: 404 });
    }

    const level = await db.level.delete({
      where: { id: levelId },
    });

    return NextResponse.json(level);
  } catch (error) {
    console.error('Error deleting level:', error);
    return NextResponse.json({ error: 'Failed to delete level' }, { status: 500 });
  }
}
