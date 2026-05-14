import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// One-time fix: update TeacherPayment records that were created at the
// beginning of May for April's work. Change their month from "5" to "4".
// This endpoint should be called once and then deleted.
export async function POST() {
  try {
    // Find all TeacherPayment records with month="5" and year=2026
    // that have paymentDate in early May (May 1-7) — these are April payments
    // made at the beginning of May
    const result = await db.teacherPayment.updateMany({
      where: {
        month: '5',
        year: 2026,
        paymentDate: {
          gte: new Date('2026-05-01T00:00:00.000Z'),
          lt: new Date('2026-05-08T00:00:00.000Z'),
        },
      },
      data: {
        month: '4', // April
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      message: `Updated ${result.count} TeacherPayment records from month 5 to month 4`,
    });
  } catch (error) {
    console.error('Error fixing teacher payments:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
