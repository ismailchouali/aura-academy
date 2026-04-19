import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serviceId: string; subjectId: string }> }
) {
  try {
    const { serviceId, subjectId } = await params;
    const body = await request.json();
    const { name, nameAr, nameFr } = body;

    if (!name || !nameAr || !nameFr) {
      return NextResponse.json({ error: 'name, nameAr, and nameFr are required' }, { status: 400 });
    }

    // Check subject exists and belongs to the service
    const subject = await db.subject.findFirst({
      where: { id: subjectId, serviceId },
    });
    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Get max order
    const maxOrder = await db.level.count({ where: { subjectId } });

    const level = await db.level.create({
      data: {
        name,
        nameAr,
        nameFr,
        subjectId,
        order: maxOrder,
      },
    });

    return NextResponse.json(level, { status: 201 });
  } catch (error) {
    console.error('Error creating level:', error);
    return NextResponse.json({ error: 'Failed to create level' }, { status: 500 });
  }
}
