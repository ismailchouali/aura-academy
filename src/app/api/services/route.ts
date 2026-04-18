import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const services = await db.service.findMany({
      include: {
        subjects: {
          include: {
            levels: {
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, nameAr, nameFr, icon, order } = body;

    if (!name || !nameAr || !nameFr) {
      return NextResponse.json({ error: 'name, nameAr, and nameFr are required' }, { status: 400 });
    }

    // Get max order if not provided
    const maxOrder = order ?? (await db.service.count());

    const service = await db.service.create({
      data: {
        name,
        nameAr,
        nameFr,
        icon: icon || null,
        order: maxOrder,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
