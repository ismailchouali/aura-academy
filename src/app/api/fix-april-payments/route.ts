import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const result = await db.teacherPayment.updateMany({
      where: { month: '5', year: 2026 },
      data: { month: '4' },
    });

    const records = await db.teacherPayment.findMany({
      where: { month: '4', year: 2026 },
      select: { id: true, teacherId: true, amount: true, month: true, year: true },
      orderBy: { amount: 'asc' },
    });

    return NextResponse.json({
      updatedCount: result.count,
      records,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
