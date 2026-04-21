import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { db } from '@/lib/db';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const BACKUP_DIR = join(process.cwd(), 'backups');
const MAX_BACKUPS = 20;

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function cleanOldBackups() {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('aura-backup-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: join(BACKUP_DIR, f),
        mtime: statSync(join(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > MAX_BACKUPS) {
      for (const file of files.slice(MAX_BACKUPS)) {
        unlinkSync(file.path);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

// POST /api/backup — Create a new backup (JSON dump of all data)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    ensureBackupDir();

    // Export all data from database
    const [
      settings,
      services,
      subjects,
      levels,
      teachers,
      teacherSubjects,
      classrooms,
      students,
      payments,
      teacherPayments,
      users,
      sessions,
      schedules,
    ] = await Promise.all([
      db.setting.findMany(),
      db.service.findMany(),
      db.subject.findMany(),
      db.level.findMany(),
      db.teacher.findMany(),
      db.teacherSubject.findMany(),
      db.classroom.findMany(),
      db.student.findMany(),
      db.payment.findMany(),
      db.teacherPayment.findMany(),
      db.user.findMany({ select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true, updatedAt: true } }),
      db.session.findMany(),
      db.schedule.findMany(),
    ]);

    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        settings,
        services,
        subjects,
        levels,
        teachers,
        teacherSubjects,
        classrooms,
        students,
        payments,
        teacherPayments,
        users,
        sessions,
        schedules,
      },
    };

    const timestamp = getTimestamp();
    const filename = `aura-backup-${timestamp}.json`;
    const backupPath = join(BACKUP_DIR, filename);

    writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');

    cleanOldBackups();

    const stats = statSync(backupPath);

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء النسخة الاحتياطية بنجاح',
      filename,
      size: stats.size,
      sizeHuman: `${(stats.size / 1024).toFixed(1)} KB`,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: 'فشل إنشاء النسخة الاحتياطية' }, { status: 500 });
  }
}

// GET /api/backup — List all backups
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    ensureBackupDir();

    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('aura-backup-') && (f.endsWith('.json') || f.endsWith('.db')))
      .map(f => {
        const stats = statSync(join(BACKUP_DIR, f));
        return {
          filename: f,
          size: stats.size,
          sizeHuman: `${(stats.size / 1024).toFixed(1)} KB`,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ backups: files, count: files.length });
  } catch (error) {
    console.error('List backups error:', error);
    return NextResponse.json({ error: 'فشل جلب النسخ الاحتياطية' }, { status: 500 });
  }
}
