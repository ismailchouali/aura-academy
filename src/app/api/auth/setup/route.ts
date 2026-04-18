import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    // Check if any users exist
    const existingUsers = await db.user.count();
    if (existingUsers > 0) {
      return NextResponse.json({ error: 'تم إنشاء المسؤول بالفعل' }, { status: 400 });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create admin user
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        email,
        password: hashedPassword,
        fullName,
        role: 'ADMIN',
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء المسؤول بنجاح',
      user: { id: user.id, email: user.email, fullName: user.fullName },
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'خطأ في إنشاء المسؤول' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const count = await db.user.count();
    return NextResponse.json({ hasUsers: count > 0 });
  } catch (error) {
    return NextResponse.json({ error: 'خطأ' }, { status: 500 });
  }
}
