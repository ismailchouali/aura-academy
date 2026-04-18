import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'غير مصادق عليه' }, { status: 401 });
    }

    // Find session
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'جلسة منتهية الصلاحية' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        role: session.user.role,
        accessPages: session.user.accessPages,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ error: 'خطأ في التحقق' }, { status: 500 });
  }
}
