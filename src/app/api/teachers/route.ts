import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const teachers = await db.teacher.findMany({
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const teacher = await db.teacher.create({
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        address: body.address,
        salary: body.salary || 0,
        percentage: body.percentage || 0,
        notes: body.notes,
        status: body.status || 'active',
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

    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    console.error('Error creating teacher:', error);
    return NextResponse.json({ error: 'Failed to create teacher' }, { status: 500 });
  }
}
