import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// GET /api/users/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, fullName: true, role: true, status: true, accessPages: true, createdAt: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'خطأ' }, { status: 500 });
  }
}

// PUT /api/users/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const { email, password, fullName, role, status, accessPages } = data;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Check email uniqueness
    if (email && email !== existing.email) {
      const emailTaken = await db.user.findFirst({ where: { email, id: { not: id } } });
      if (emailTaken) {
        return NextResponse.json({ error: 'هذا البريد الإلكتروني مستخدم بالفعل' }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined && password !== '') {
      // Hash new password with bcrypt
      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    }
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (accessPages !== undefined) updateData.accessPages = accessPages;

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, fullName: true, role: true, status: true, accessPages: true, createdAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'خطأ في تحديث المستخدم' }, { status: 500 });
  }
}

// DELETE /api/users/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Delete sessions first
    await db.session.deleteMany({ where: { userId: id } });
    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'خطأ في حذف المستخدم' }, { status: 500 });
  }
}
