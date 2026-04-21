import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const teacherPayment = await db.teacherPayment.findUnique({
      where: { id },
      include: {
        teacher: true,
      },
    });

    if (!teacherPayment) {
      return NextResponse.json(
        { error: 'Teacher payment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(teacherPayment);
  } catch (error) {
    console.error('Error fetching teacher payment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teacher payment' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const teacherPayment = await db.teacherPayment.update({
      where: { id },
      data: {
        amount: body.amount,
        month: body.month,
        year: body.year,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
        notes: body.notes,
        status: body.status,
      },
      include: {
        teacher: true,
      },
    });

    return NextResponse.json(teacherPayment);
  } catch (error) {
    console.error('Error updating teacher payment:', error);
    return NextResponse.json(
      { error: 'Failed to update teacher payment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    await db.teacherPayment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting teacher payment:', error);
    return NextResponse.json(
      { error: 'Failed to delete teacher payment' },
      { status: 500 }
    );
  }
}
