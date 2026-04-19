import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const body = await request.json();
    const { name, nameAr, nameFr } = body;

    if (!name || !nameAr || !nameFr) {
      return NextResponse.json({ error: 'name, nameAr, and nameFr are required' }, { status: 400 });
    }

    // Check service exists
    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Get max order
    const maxOrder = await db.subject.count({ where: { serviceId } });

    const subject = await db.subject.create({
      data: {
        name,
        nameAr,
        nameFr,
        serviceId,
        order: maxOrder,
      },
    });

    return NextResponse.json(subject, { status: 201 });
  } catch (error) {
    console.error('Error creating subject:', error);
    return NextResponse.json({ error: 'Failed to create subject' }, { status: 500 });
  }
}
