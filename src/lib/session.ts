import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'SECRETARY';
}

export async function getSession(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get('aura_session')?.value;
  if (!token) return null;

  try {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date() || session.user.status !== 'active') {
      if (session) {
        await db.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role as 'ADMIN' | 'SECRETARY',
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  return { user };
}

export async function requireAdmin(request: NextRequest): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'غير مصرح - مدير فقط' }, { status: 403 });
  }
  return { user };
}
