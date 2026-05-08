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

/** Build a UTC Date that corresponds to 00:00:00.000 on the given Casablanca date */
function casablancaStart(year: number, month: number, day: number) {
  // Casablanca is UTC+1 (no DST since 2018).
  // 00:00 Casablanca = 23:00 UTC of the previous day.
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** Build a UTC Date that corresponds to 23:59:59.999 on the given Casablanca date */
function casablancaEnd(year: number, month: number, day: number) {
  // 23:59:59 Casablanca = 22:59:59 UTC of the same calendar day.
  return new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nowParts = casablancaParts(new Date());
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : nowParts.year;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

    // Fetch ALL students (no date filter) and group them by Casablanca month/year
    // This avoids timezone edge-case bugs in the Prisma date filter.
    // For performance, we could add a loose UTC filter as an optimization later.

    // Build a loose UTC range that covers the entire Casablanca year
    // Casablanca year starts at Jan 1 00:00 local = Dec 31 previous year 23:00 UTC
    const utcStart = casablancaStart(year, 1, 1);
    const utcEnd = casablancaEnd(year, 12, 31);

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

    // Group by Casablanca month
    const monthlyCounts: Record<string, number> = {};
    const monthlyStudents: Record<string, typeof students> = {};

    for (const s of students) {
      const p = casablancaParts(new Date(s.enrollmentDate));
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;

      // Only count students matching the requested year
      if (p.year !== year) continue;

      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
      if (!monthlyStudents[key]) monthlyStudents[key] = [];
      monthlyStudents[key].push(s);
    }

    // If a specific month is requested, filter to only that month's students
    let filteredStudents = students;
    if (month) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      filteredStudents = monthlyStudents[key] || [];
    }

    // Get month list for the filter
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
