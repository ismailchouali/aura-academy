import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 });
    }

    // Find user
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    // Check password with bcrypt (supports both hashed and legacy plaintext)
    let passwordValid = false;
    if (user.password.startsWith('$2')) {
      // Already hashed with bcrypt
      passwordValid = await bcrypt.compare(password, user.password);
    } else {
      // Legacy plaintext password — validate and upgrade to hash
      passwordValid = user.password === password;
      if (passwordValid) {
        // Auto-upgrade: re-hash the password in-place
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        await db.user.update({
          where: { id: user.id },
          data: { password: hash },
        });
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'هذا الحساب معطل' }, { status: 403 });
    }

    // Create session
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      token,
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'خطأ في تسجيل الدخول' }, { status: 500 });
  }
}
