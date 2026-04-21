import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/notifications/unread-count — Quick unread count
export async function GET() {
  try {
    const unreadCount = await db.notification.count({
      where: { isRead: false },
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json({ unreadCount: 0 });
  }
}
