import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { db } from '@/lib/db';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BACKUP_DIR = join(process.cwd(), 'backups');

// POST /api/backup/restore — Restore from a backup file
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { filename } = body;

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'اسم الملف مطلوب' }, { status: 400 });
    }

    // Validate filename (prevent path traversal)
    const safeName = filename.replace(/[^a-zA-Z0-9\-_.]/g, '');
    if (!safeName.startsWith('aura-backup-')) {
      return NextResponse.json({ error: 'اسم ملف غير صالح' }, { status: 400 });
    }

    const backupPath = join(BACKUP_DIR, safeName);
    if (!existsSync(backupPath)) {
      return NextResponse.json({ error: 'النسخة الاحتياطية غير موجودة' }, { status: 404 });
    }

    // Create safety backup of current state first
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    ensureBackupDir();
    
    const safetyBackup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      type: 'auto-safety-before-restore',
    };
    
    const [
      settings, services, subjects, levels,
      teachers, teacherSubjects, classrooms,
      students, payments, teacherPayments,
      users, sessions, schedules,
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
      db.user.findMany(),
      db.session.findMany(),
      db.schedule.findMany(),
    ]);

    safetyBackup.data = {
      settings, services, subjects, levels,
      teachers, teacherSubjects, classrooms,
      students, payments, teacherPayments,
      users, sessions, schedules,
    };

    writeFileSync(
      join(BACKUP_DIR, `aura-pre-restore-${timestamp}.json`),
      JSON.stringify(safetyBackup, null, 2),
      'utf-8'
    );

    // Read backup file
    const raw = readFileSync(backupPath, 'utf-8');
    const backup = JSON.parse(raw);
    const data = backup.data;

    // Restore data in correct order (respecting foreign keys)
    // 1. Delete in reverse dependency order
    await db.session.deleteMany();
    await db.schedule.deleteMany();
    await db.payment.deleteMany();
    await db.teacherPayment.deleteMany();
    await db.student.deleteMany();
    await db.teacherSubject.deleteMany();
    await db.teacher.deleteMany();
    await db.level.deleteMany();
    await db.subject.deleteMany();
    await db.classroom.deleteMany();
    await db.service.deleteMany();
    await db.setting.deleteMany();
    await db.user.deleteMany();

    // 2. Recreate in dependency order
    if (data.users?.length) {
      for (const user of data.users) {
        await db.user.create({ data: user }).catch(() => {});
      }
    }

    if (data.settings?.length) {
      for (const setting of data.settings) {
        await db.setting.create({ data: setting }).catch(() => {});
      }
    }

    if (data.services?.length) {
      for (const service of data.services) {
        await db.service.create({ data: service }).catch(() => {});
      }
    }

    if (data.classrooms?.length) {
      for (const classroom of data.classrooms) {
        await db.classroom.create({ data: classroom }).catch(() => {});
      }
    }

    if (data.subjects?.length) {
      for (const subject of data.subjects) {
        await db.subject.create({ data: subject }).catch(() => {});
      }
    }

    if (data.levels?.length) {
      for (const level of data.levels) {
        await db.level.create({ data: level }).catch(() => {});
      }
    }

    if (data.teachers?.length) {
      for (const teacher of data.teachers) {
        await db.teacher.create({ data: teacher }).catch(() => {});
      }
    }

    if (data.teacherSubjects?.length) {
      for (const ts of data.teacherSubjects) {
        await db.teacherSubject.create({ data: ts }).catch(() => {});
      }
    }

    if (data.students?.length) {
      for (const student of data.students) {
        await db.student.create({ data: student }).catch(() => {});
      }
    }

    if (data.payments?.length) {
      for (const payment of data.payments) {
        await db.payment.create({ data: payment }).catch(() => {});
      }
    }

    if (data.teacherPayments?.length) {
      for (const tp of data.teacherPayments) {
        await db.teacherPayment.create({ data: tp }).catch(() => {});
      }
    }

    if (data.schedules?.length) {
      for (const schedule of data.schedules) {
        await db.schedule.create({ data: schedule }).catch(() => {});
      }
    }

    if (data.sessions?.length) {
      for (const session of data.sessions) {
        await db.session.create({ data: session }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم استعادة النسخة الاحتياطية بنجاح',
      restoredFrom: safeName,
      safetyBackup: `aura-pre-restore-${timestamp}.json`,
    });
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json({ error: 'فشل استعادة النسخة الاحتياطية: ' + (error instanceof Error ? error.message : 'خطأ غير معروف') }, { status: 500 });
  }
}

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}
