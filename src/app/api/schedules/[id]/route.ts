import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
  message: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const schedule = await db.schedule.findUnique({
      where: { id },
      include: {
        subject: { include: { service: true } },
        teacher: true,
        classroom: true,
        level: true,
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { dayOfWeek, startTime, endTime, classroomId, teacherId } = body;

    // Check conflicts (excluding the current schedule)
    if (dayOfWeek && startTime && endTime) {
      const existingSchedules = await db.schedule.findMany({
        where: {
          dayOfWeek,
          id: { not: id },
        },
        include: {
          classroom: true,
          teacher: true,
          subject: true,
        },
      });

      const conflicts: ConflictInfo[] = [];

      for (const existing of existingSchedules) {
        if (!timesOverlap(startTime, endTime, existing.startTime, existing.endTime)) continue;

        if (classroomId && existing.classroomId === classroomId) {
          conflicts.push({
            type: 'classroom',
            day: dayOfWeek,
            dayLabel: dayNamesAr[dayOfWeek] || dayOfWeek,
            startTime: existing.startTime,
            endTime: existing.endTime,
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
            message: `هذا الأستاذ لديه حصة في ${dayNamesAr[dayOfWeek] || dayOfWeek} من ${existing.startTime} إلى ${existing.endTime} (${existing.subject?.nameAr || existing.subject?.name})`,
          });
        }
      }

      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            error: 'conflict',
            message: 'يوجد تعارض في الجدول',
            conflicts,
          },
          { status: 409 }
        );
      }
    }

    const schedule = await db.schedule.update({
      where: { id },
      data: {
        subjectId: body.subjectId,
        teacherId: body.teacherId,
        classroomId: body.classroomId,
        levelId: body.levelId,
        dayOfWeek: body.dayOfWeek,
        startTime: body.startTime,
        endTime: body.endTime,
        group: body.group,
        sessionType: body.sessionType,
        isRecurring: body.isRecurring,
      },
      include: {
        subject: { include: { service: true } },
        teacher: true,
        classroom: true,
        level: true,
      },
    });

    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}
