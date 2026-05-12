import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const TZ = 'Africa/Casablanca';

/** Get the Casablanca year/month/day components from a JS Date */
function casablancaParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.format(date).split('-');
  return { year: parseInt(parts[0]), month: parseInt(parts[1]), day: parseInt(parts[2]) };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nowParts = casablancaParts(new Date());
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : nowParts.year;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

    // Build a WIDE UTC range that definitely covers every Casablanca moment
    // in the requested year.
    //
    // Casablanca is UTC+1 (no DST since 2018), so:
    //   Jan 1 00:00 Casablanca  =  Dec 31 23:00 UTC (previous year)
    //   Dec 31 23:59 Casablanca =  Dec 31 22:59 UTC (same year)
    //
    // We add a 2-day buffer on each side to be safe.
    const utcStart = new Date(Date.UTC(year, 0, -1, 0, 0, 0, 0));   // Dec 30 prev year 00:00 UTC
    const utcEnd   = new Date(Date.UTC(year, 12, 2, 0, 0, 0, 0));  // Jan 2 next year  00:00 UTC

    const students = await db.student.findMany({
      where: {
        enrollmentDate: {
          gte: utcStart,
          lte: utcEnd,
        },
      },
      include: {
        level: {
          include: {
            subject: {
              include: { service: true },
            },
          },
        },
        teacher: true,
      },
      orderBy: { enrollmentDate: 'desc' },
    });

    // Group by Casablanca month (using Intl to get the REAL local month)
    const monthlyCounts: Record<string, number> = {};
    const monthlyStudents: Record<string, typeof students> = {};

    for (const s of students) {
      const p = casablancaParts(new Date(s.enrollmentDate));
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;

      // Only count students whose Casablanca year matches
      if (p.year !== year) continue;

      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
      if (!monthlyStudents[key]) monthlyStudents[key] = [];
      monthlyStudents[key].push(s);
    }

    // If a specific month is requested, return only that month's students
    let filteredStudents = students;
    if (month) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      filteredStudents = monthlyStudents[key] || [];
    }

    // Build the month label array for the frontend filter
    const monthLabels: { value: number; count: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      monthLabels.push({ value: m, count: monthlyCounts[key] || 0 });
    }

    return NextResponse.json({
      students: filteredStudents,
      total: filteredStudents.length,
      monthlyCounts,
      monthLabels,
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
  }
}
