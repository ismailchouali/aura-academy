import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dayOfWeek = searchParams.get('dayOfWeek');
    const classroomId = searchParams.get('classroomId');
    const teacherId = searchParams.get('teacherId');
    const subjectId = searchParams.get('subjectId');
    const sessionType = searchParams.get('sessionType');

    const where: Record<string, unknown> = {};

    if (dayOfWeek) {
      where.dayOfWeek = dayOfWeek;
    }
    if (classroomId) {
      where.classroomId = classroomId;
    }
    if (teacherId) {
      where.teacherId = teacherId;
    }
    if (subjectId) {
      where.subjectId = subjectId;
    }
    if (sessionType) {
      where.sessionType = sessionType;
    }

    const schedules = await db.schedule.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        subject: { include: { service: true } },
        teacher: true,
        classroom: true,
        level: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const scheduleData = {
      subjectId: body.subjectId,
      teacherId: body.teacherId || null,
      classroomId: body.classroomId || null,
      levelId: body.levelId || null,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
      group: body.group || null,
      sessionType: body.sessionType || 'fixed',
      isRecurring: body.isRecurring || false,
    };

    const schedule = await db.schedule.create({
      data: scheduleData,
      include: {
        subject: { include: { service: true } },
        teacher: true,
        classroom: true,
        level: true,
      },
    });

    // If recurring, create copies for all other days of the week
    let createdSchedules = [schedule];
    if (body.isRecurring && body.daysOfWeek && Array.isArray(body.daysOfWeek)) {
      for (const day of body.daysOfWeek) {
        if (day !== body.dayOfWeek) {
          const recurring = await db.schedule.create({
            data: {
              ...scheduleData,
              dayOfWeek: day,
              isRecurring: true,
            },
            include: {
              subject: { include: { service: true } },
              teacher: true,
              classroom: true,
              level: true,
            },
          });
          createdSchedules.push(recurring);
        }
      }
    }

    return NextResponse.json(createdSchedules.length === 1 ? schedule : createdSchedules, { status: 201 });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}
