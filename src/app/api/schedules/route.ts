import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';

// Helper functions
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

const dayNamesAr: Record<string, string> = {
  '1': 'الأحد',
  '2': 'الإثنين',
  '3': 'الثلاثاء',
  '4': 'الأربعاء',
  '5': 'الخميس',
  '6': 'الجمعة',
  '7': 'السبت',
};

interface ConflictInfo {
  type: 'classroom' | 'teacher';
  day: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  classroomName?: string;
  teacherName?: string;
  subjectName?: string;
  message: string;
}

async function checkConflicts(
  dayOfWeek: string,
  startTime: string,
  endTime: string,
  classroomId: string | null,
  teacherId: string | null,
  excludeScheduleId?: string
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = [];

  const existingSchedules = await db.schedule.findMany({
    where: {
      dayOfWeek,
      ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
    },
    include: {
      classroom: true,
      teacher: true,
      subject: true,
    },
  });

  for (const existing of existingSchedules) {
    if (!timesOverlap(startTime, endTime, existing.startTime, existing.endTime)) continue;

    if (classroomId && existing.classroomId === classroomId) {
      conflicts.push({
        type: 'classroom',
        day: dayOfWeek,
        dayLabel: dayNamesAr[dayOfWeek] || dayOfWeek,
        startTime: existing.startTime,
        endTime: existing.endTime,
        classroomName: existing.classroom?.nameAr || existing.classroom?.name,
        subjectName: existing.subject?.nameAr || existing.subject?.name,
        message: `هذه القاعة مشغولة في ${dayNamesAr[dayOfWeek] || dayOfWeek} من ${existing.startTime} إلى ${existing.endTime} (${existing.subject?.nameAr || existing.subject?.name})`,
      });
    }

    if (teacherId && existing.teacherId === teacherId) {
      conflicts.push({
        type: 'teacher',
        day: dayOfWeek,
        dayLabel: dayNamesAr[dayOfWeek] || dayOfWeek,
        startTime: existing.startTime,
        endTime: existing.endTime,
        teacherName: existing.teacher?.fullName,
        subjectName: existing.subject?.nameAr || existing.subject?.name,
        message: `هذا الأستاذ لديه حصة في ${dayNamesAr[dayOfWeek] || dayOfWeek} من ${existing.startTime} إلى ${existing.endTime} (${existing.subject?.nameAr || existing.subject?.name})`,
      });
    }
  }

  return conflicts;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    const {
      dayOfWeek,
      startTime,
      endTime,
      classroomId,
      teacherId,
      sessionType,
      isRecurring,
      daysOfWeek,
    } = body;

    // Determine which days to check/create
    const daysToCreate: string[] = [];
    if (isRecurring && daysOfWeek && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
      daysToCreate.push(...daysOfWeek);
    } else if (dayOfWeek) {
      daysToCreate.push(dayOfWeek);
    }

    if (daysToCreate.length === 0) {
      return NextResponse.json(
        { error: 'يرجى تحديد يوم واحد على الأقل' },
        { status: 400 }
      );
    }

    // Check conflicts for all days
    const allConflicts: ConflictInfo[] = [];
    for (const day of daysToCreate) {
      const dayConflicts = await checkConflicts(
        day,
        startTime,
        endTime,
        classroomId || null,
        teacherId || null
      );
      allConflicts.push(...dayConflicts);
    }

    if (allConflicts.length > 0) {
      return NextResponse.json(
        {
          error: 'conflict',
          message: 'يوجد تعارض في الجدول',
          conflicts: allConflicts,
        },
        { status: 409 }
      );
    }

    // Create schedules
    const scheduleData = {
      subjectId: body.subjectId,
      teacherId: body.teacherId || null,
      classroomId: body.classroomId || null,
      levelId: body.levelId || null,
      dayOfWeek: daysToCreate[0],
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
    const createdSchedules = [schedule];
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
