import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Revert: change month from "4" back to "5" for 2025 TeacherPayment records
    const result = await db.teacherPayment.updateMany({
      where: { month: '4', year: 2025 },
      data: { month: '5' },
    });

    // Verify current state
    const month4Records = await db.teacherPayment.findMany({
      where: { month: '4', year: 2025 },
      select: { id: true, teacherId: true, amount: true, month: true },
    });
    const month5Records = await db.teacherPayment.findMany({
      where: { month: '5', year: 2025 },
      select: { id: true, teacherId: true, amount: true, month: true },
    });

    return NextResponse.json({
      updatedCount: result.count,
      month4Records,
      month5Records,
      message: `Reverted ${result.count} records from month 4 back to month 5`,
    });
  } catch (error) {
    console.error('Error reverting teacher payments:', error);
    return NextResponse.json({ error: 'Failed to revert' }, { status: 500 });
  }
}
