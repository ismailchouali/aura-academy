import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * One-time cleanup: Remove duplicate levels from all services.
 * Keeps only the first occurrence of each level name per subject.
 * Migrates any students/schedules from duplicate levels to kept ones.
 * DELETE THIS FILE AFTER RUNNING.
 */
export async function POST() {
  try {
    // 1. Get all services with their subjects and levels
    const services = await db.service.findMany({
      include: {
        subjects: {
          include: {
            levels: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    let totalDeleted = 0;
    const results: { service: string; subject: string; removed: string[] }[] = [];

    // 2. For each subject, find and remove duplicate levels
    for (const service of services) {
      for (const subject of service.subjects) {
        const seen = new Map<string, string>(); // name -> id (keep first)
        const duplicateIds: string[] = [];

        for (const level of subject.levels) {
          if (seen.has(level.name)) {
            duplicateIds.push(level.id);
          } else {
            seen.set(level.name, level.id);
          }
        }

        if (duplicateIds.length === 0) continue;

        // Migrate students from duplicate levels to the kept level
        for (const dupId of duplicateIds) {
          const dupLevel = subject.levels.find(l => l.id === dupId);
          if (!dupLevel) continue;
          const keptId = seen.get(dupLevel.name);
          if (keptId) {
            await db.student.updateMany({
              where: { levelId: dupId },
              data: { levelId: keptId },
            });
            await db.schedule.updateMany({
              where: { levelId: dupId },
              data: { levelId: keptId },
            });
          }
        }

        // Delete duplicate levels
        await db.level.deleteMany({
          where: { id: { in: duplicateIds } },
        });

        const removedNames = duplicateIds.map(id => {
          const lvl = subject.levels.find(l => l.id === id);
          return `${lvl?.name || id}`;
        });

        results.push({
          service: service.nameAr,
          subject: subject.nameAr,
          removed: removedNames,
        });
        totalDeleted += duplicateIds.length;
      }
    }

    return NextResponse.json({
      success: true,
      totalDeleted,
      results,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
