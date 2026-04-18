import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// GET /api/users — list all users (admin only check via cookie)
export async function GET() {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        accessPages: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'خطأ في جلب المستخدمين' }, { status: 500 });
  }
}

// POST /api/users — create new user
export async function POST(request: Request) {
  try {
    const { email, password, fullName, role, status, accessPages } = await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور والاسم مطلوبون' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'هذا البريد الإلكتروني مستخدم بالفعل' }, { status: 409 });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        role: role || 'SECRETARY',
        status: status || 'active',
        accessPages: accessPages || '',
      },
      select: {
        id: true, email: true, fullName: true, role: true, status: true, accessPages: true, createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'خطأ في إنشاء المستخدم' }, { status: 500 });
  }
}
