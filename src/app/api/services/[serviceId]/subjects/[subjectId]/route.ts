import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; subjectId: string }> }
) {
  try {
    const { serviceId, subjectId } = await params;
    const body = await request.json();
    const { name, nameAr, nameFr } = body;

    // Verify the subject belongs to the service
    const existing = await db.subject.findFirst({
      where: { id: subjectId, serviceId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const subject = await db.subject.update({
      where: { id: subjectId },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameFr !== undefined && { nameFr }),
      },
    });

    return NextResponse.json(subject);
  } catch (error) {
    console.error('Error updating subject:', error);
    return NextResponse.json({ error: 'Failed to update subject' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; subjectId: string }> }
) {
  try {
    const { serviceId, subjectId } = await params;

    // Verify the subject belongs to the service
    const existing = await db.subject.findFirst({
      where: { id: subjectId, serviceId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const subject = await db.subject.delete({
      where: { id: subjectId },
    });

    return NextResponse.json(subject);
  } catch (error) {
    console.error('Error deleting subject:', error);
    return NextResponse.json({ error: 'Failed to delete subject' }, { status: 500 });
  }
}
