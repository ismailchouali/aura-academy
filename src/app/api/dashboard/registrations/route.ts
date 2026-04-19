import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

    // Build date filters
    const startDate = new Date(year, (month || 1) - 1, 1);
    const endDate = month
      ? new Date(year, month, 0, 23, 59, 59, 999) // last day of month
      : new Date(year, 11, 31, 23, 59, 59, 999); // last day of year

    const students = await db.student.findMany({
      where: {
        enrollmentDate: {
          gte: startDate,
          lte: endDate,
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

    // Group by month
    const monthlyCounts: Record<string, number> = {};
    for (const s of students) {
      const d = new Date(s.enrollmentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
    }

    // Get month list for the filter
    const monthLabels: { value: number; count: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      monthLabels.push({ value: m, count: monthlyCounts[key] || 0 });
    }

    return NextResponse.json({
      students,
      total: students.length,
      monthlyCounts,
      monthLabels,
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
  }
}
