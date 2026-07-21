import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  try {
    // Find all students with a levelId that need migration
    const students = await db.student.findMany({
      where: { levelId: { not: null } },
      include: {
        level: {
          include: {
            subject: {
              include: { service: true },
            },
          },
        },
        teacher: true,
        enrollments: true,
        payments: {
          where: { enrollmentId: null },
        },
      },
    });

    let enrollmentsCreated = 0;
    let paymentsLinked = 0;
    let skippedNoLevel = 0;
    let skippedAlreadyExists = 0;

    for (const student of students) {
      // Skip if level data is missing (orphaned foreign key)
      if (!student.level || !student.level.subject || !student.level.subject.service) {
        skippedNoLevel++;
        continue;
      }

      // Check if an enrollment already exists for this student+service+level
      const existingEnrollment = student.enrollments.find(
        (e) => e.serviceId === student.level!.subject.service.id && e.levelId === student.levelId,
      );
      if (existingEnrollment) {
        skippedAlreadyExists++;
        continue;
      }

      // Create the enrollment
      const enrollment = await db.studentEnrollment.create({
        data: {
          studentId: student.id,
          serviceId: student.level.subject.service.id,
          subjectId: student.level.subject.id,
          levelId: student.levelId!,
          teacherId: student.teacherId,
          monthlyFee: student.monthlyFee,
          packMonths: student.packMonths,
          enrollmentDate: student.enrollmentDate,
        },
      });

      enrollmentsCreated++;

      // Link existing unlinked payments to this new enrollment
      if (student.payments.length > 0) {
        const unlinkedPaymentIds = student.payments.map((p) => p.id);

        const result = await db.payment.updateMany({
          where: { id: { in: unlinkedPaymentIds } },
          data: { enrollmentId: enrollment.id },
        });

        paymentsLinked += result.count;
      }
    }

    return NextResponse.json({
      success: true,
      studentsProcessed: students.length,
      enrollmentsCreated,
      paymentsLinked,
      skippedNoLevel,
      skippedAlreadyExists,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}