import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const classrooms = await db.classroom.findMany({
      include: {
        schedules: {
          include: {
            subject: true,
            teacher: true,
            level: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(classrooms);
  } catch (error) {
    console.error('Error fetching classrooms:', error);
    return NextResponse.json({ error: 'Failed to fetch classrooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const classroom = await db.classroom.create({
      data: {
        name: body.name,
        nameAr: body.nameAr,
        capacity: body.capacity || 20,
      },
      include: {
        schedules: true,
      },
    });

    return NextResponse.json(classroom, { status: 201 });
  } catch (error) {
    console.error('Error creating classroom:', error);
    return NextResponse.json({ error: 'Failed to create classroom' }, { status: 500 });
  }
}
