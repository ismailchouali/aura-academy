import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/notifications/mark-read — Mark a single notification as read
export async function PUT(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }

    await db.notification.update({
      where: { id },
      data: { isRead: true },
    });

    const unreadCount = await db.notification.count({ where: { isRead: false } });

    return NextResponse.json({ success: true, unreadCount });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
