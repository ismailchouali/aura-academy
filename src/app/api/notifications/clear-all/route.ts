import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/notifications/clear-all — Delete all notifications
export async function DELETE() {
  try {
    const result = await db.notification.deleteMany({});

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return NextResponse.json({ error: 'Failed to clear' }, { status: 500 });
  }
}
