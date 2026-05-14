import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const allPayments = await db.teacherPayment.findMany({
      select: { id: true, teacherId: true, amount: true, month: true, year: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ total: allPayments.length, payments: allPayments });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
