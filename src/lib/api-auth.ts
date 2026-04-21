import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Check session from cookie - returns user or null
export async function getSessionUser(request: NextRequest) {
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

// Wrapper to add auth check to any handler
export function withAuth(handler: (req: NextRequest, ctx: Record<string, unknown>) => Promise<NextResponse>) {
  return async (request: NextRequest, context?: Record<string, unknown>) => {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول' }, { status: 401 });
    }
    return handler(request, { user, ...context });
  };
}

// Wrapper to add admin-only auth check
export function withAdmin(handler: (req: NextRequest, ctx: Record<string, unknown>) => Promise<NextResponse>) {
  return async (request: NextRequest, context?: Record<string, unknown>) => {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح - مدير فقط' }, { status: 403 });
    }
    return handler(request, { user, ...context });
  };
}
