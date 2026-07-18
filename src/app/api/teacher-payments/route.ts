import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper: get previous month number and year (handles year boundary)
function getPrevMonth(month: number, year: number): { month: number; year: number } {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

// Helper: get next month number and year (handles year boundary)
function getNextMonth(month: number, year: number): { month: number; year: number } {
  if (month === 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

// Helper: add N months to a given month/year (handles year boundaries)
function addMonths(month: number, year: number, n: number): { month: number; year: number } {
  let m = month;
  let y = year;
  for (let i = 0; i < n; i++) {
    const next = getNextMonth(m, y);
    m = next.month;
    y = next.year;
  }
  return { month: m, year: y };
}

// Helper: check if two month/year pairs are equal
function isSameMonth(a: { month: number; year: number }, b: { month: number; year: number }): boolean {
  return a.month === b.month && a.year === b.year;
}

// Helper: get the last day of a given month
function getLastDayOfMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate the monthly contribution of a single payment for a given target month/year.
 * Returns the monthly amount if the target month falls within the payment's coverage period, else 0.
 *
 * Coverage algorithm:
 *   - Paid 1st–15th → effective start = same month
 *   - Paid 16th–end  → effective start = next month
 *   - Pack covers N consecutive months starting from effective start
 */
function calcPaymentContribution(
  payment: { paymentDate: Date | string | null; paidAmount: number; packMonths: number },
  targetMonth: number,
  targetYear: number,
): number {
  const pDate = payment.paymentDate ? new Date(payment.paymentDate) : null;
  if (!pDate) return 0;

  const packMonths = payment.packMonths || 1;
  const monthlyAmount = (payment.paidAmount || 0) / packMonths;

  const payMonth = pDate.getMonth() + 1;
  const payYear = pDate.getFullYear();
  const payDay = pDate.getDate();

  let effectiveStart: { month: number; year: number };
  if (payDay >= 1 && payDay <= 15) {
    effectiveStart = { month: payMonth, year: payYear };
  } else {
    effectiveStart = getNextMonth(payMonth, payYear);
  }

  for (let i = 0; i < packMonths; i++) {
    const coveredMonth = addMonths(effectiveStart.month, effectiveStart.year, i);
    if (isSameMonth(coveredMonth, { month: targetMonth, year: targetYear })) {
      return monthlyAmount;
    }
  }

  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const calculate = searchParams.get('calculate') === 'true';

    // Calculation mode: return auto-calculation data for teachers
    if (calculate) {
      const specificTeacherId = teacherId;
      const calcMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const calcYear = year ? parseInt(year) : new Date().getFullYear();

      // ─── 1. Fetch teachers ──────────────────────────────────────
      const teacherWhere: Record<string, unknown> = { status: 'active' };
      if (specificTeacherId) teacherWhere.id = specificTeacherId;

      const teachers = await db.teacher.findMany({
        where: Object.keys(teacherWhere).length > 0 ? teacherWhere : undefined,
        include: { subjects: { include: { subject: true } } },
        orderBy: { createdAt: 'desc' },
      });

      // ─── 2. Fetch active enrollments (new multi-enrollment system) ──
      const enrollmentWhere: Record<string, unknown> = { status: 'active' };
      if (specificTeacherId) enrollmentWhere.teacherId = specificTeacherId;

      const teacherEnrollments = await db.studentEnrollment.findMany({
        where: Object.keys(enrollmentWhere).length > 0 ? enrollmentWhere : undefined,
        include: {
          student: true,
          service: true,
          subject: true,
          level: true,
          teacher: true,
        },
      });

      // Keep only enrollments with active students and a teacher assigned
      const activeEnrollments = teacherEnrollments.filter(
        (e) => e.student && e.student.status === 'active' && e.teacherId,
      );

      // ─── 3. Fetch legacy students (no enrollments at all) ──────
      const legacyWhere: Record<string, unknown> = {
        status: 'active',
        enrollments: { none: {} },
      };
      if (specificTeacherId) legacyWhere.teacherId = specificTeacherId;

      const legacyStudents = await db.student.findMany({
        where: Object.keys(legacyWhere).length > 0 ? legacyWhere : undefined,
        include: {
          level: { include: { subject: { include: { service: true } } } },
        },
      });

      // ─── 4. Fetch payments ─────────────────────────────────────
      // 4a. Enrollment-linked payments (enrollmentId matches a teacher's enrollment)
      const enrollmentIds = activeEnrollments.map((e) => e.id);
      const enrollmentPayments = enrollmentIds.length > 0
        ? await db.payment.findMany({
            where: {
              enrollmentId: { in: enrollmentIds },
              status: { in: ['paid', 'partial'] },
              paidAmount: { gt: 0 },
            },
          })
        : [];

      // 4b. Legacy student payments
      const legacyStudentIds = legacyStudents.map((s) => s.id);
      const legacyPayments = legacyStudentIds.length > 0
        ? await db.payment.findMany({
            where: {
              studentId: { in: legacyStudentIds },
              status: { in: ['paid', 'partial'] },
              paidAmount: { gt: 0 },
            },
          })
        : [];

      // ─── 5. Calculate per-enrollment monthly contribution ──────
      const contributionByEnrollment = new Map<string, number>();

      for (const p of enrollmentPayments) {
        if (!p.enrollmentId) continue;
        const contribution = calcPaymentContribution(p, calcMonth, calcYear);
        if (contribution > 0) {
          const existing = contributionByEnrollment.get(p.enrollmentId) || 0;
          contributionByEnrollment.set(p.enrollmentId, existing + contribution);
        }
      }

      // ─── 6. Calculate per-legacy-student monthly contribution ──
      const legacyContributionByStudent = new Map<string, number>();

      for (const p of legacyPayments) {
        const contribution = calcPaymentContribution(p, calcMonth, calcYear);
        if (contribution > 0) {
          const existing = legacyContributionByStudent.get(p.studentId) || 0;
          legacyContributionByStudent.set(p.studentId, existing + contribution);
        }
      }

      // ─── 7. Build per-teacher calculations ─────────────────────
      // =============================================
      // ALGORITHM (updated for multi-enrollment):
      //
      // 1. totalStudents = UNIQUE active students linked to teacher
      //    via enrollments + legacy students (teacherId, no enrollments)
      //
      // 2. For enrollment students: find payments linked to the
      //    SPECIFIC enrollment (enrollmentId match)
      //    monthlyAmount = paidAmount / packMonths
      //    effectiveStart based on paymentDate day
      //    If calcMonth falls within coverage → add to totalCollected
      //
      // 3. For legacy students: same algorithm but using payments
      //    without enrollmentId
      //
      // 4. Groups are organized by enrollment's service/subject/level
      //    (new system) or student's level (legacy)
      // =============================================

      const calculations = teachers.map((teacher) => {
        // --- Enrollment-based students for this teacher ---
        const teacherEnrollments = activeEnrollments.filter(
          (e) => e.teacherId === teacher.id,
        );
        const uniqueEnrollmentStudentIds = new Set(
          teacherEnrollments.map((e) => e.studentId),
        );
        const totalStudentsFromEnrollments = uniqueEnrollmentStudentIds.size;

        // --- Legacy students for this teacher ---
        const teacherLegacyStudents = legacyStudents.filter(
          (s) => s.teacherId === teacher.id,
        );
        const totalStudentsFromLegacy = teacherLegacyStudents.length;

        const totalStudents = totalStudentsFromEnrollments + totalStudentsFromLegacy;

        // --- Total collected ---
        const totalCollectedFromEnrollments = teacherEnrollments.reduce(
          (sum, e) => sum + (contributionByEnrollment.get(e.id) || 0),
          0,
        );
        const totalCollectedFromLegacy = teacherLegacyStudents.reduce(
          (sum, student) => sum + (legacyContributionByStudent.get(student.id) || 0),
          0,
        );
        const totalCollected = totalCollectedFromEnrollments + totalCollectedFromLegacy;

        // --- Teacher share ---
        const percentage = teacher.percentage || 0;
        const teacherShare = (totalCollected * percentage) / 100;

        // --- Groups breakdown ---
        const groupStudentSets = new Map<string, Set<string>>();
        const groupData = new Map<
          string,
          {
            groupName: string;
            subjectName: string;
            subjectNameAr: string;
            levelName: string;
            levelNameAr: string;
            collected: number;
          }
        >();

        const addGroupEntry = (
          key: string,
          studentId: string,
          contribution: number,
          groupName: string,
          subjectName: string,
          subjectNameAr: string,
          levelName: string,
          levelNameAr: string,
        ) => {
          const studentSet = groupStudentSets.get(key) || new Set<string>();
          studentSet.add(studentId);
          groupStudentSets.set(key, studentSet);

          const existing = groupData.get(key);
          if (existing) {
            existing.collected += contribution;
          } else {
            groupData.set(key, {
              groupName,
              subjectName,
              subjectNameAr,
              levelName,
              levelNameAr,
              collected: contribution,
            });
          }
        };

        // Enrollment groups (by enrollment's level/subject/service)
        for (const e of teacherEnrollments) {
          const contribution = contributionByEnrollment.get(e.id) || 0;

          if (e.level && e.subject) {
            addGroupEntry(
              e.level.id,
              e.studentId,
              contribution,
              `${e.subject.name} - ${e.level.name}`,
              e.subject.name,
              e.subject.nameAr || e.subject.name,
              e.level.name,
              e.level.nameAr || e.level.name,
            );
          } else if (e.subject) {
            addGroupEntry(
              `sub_noLevel_${e.subjectId}`,
              e.studentId,
              contribution,
              e.subject.name,
              e.subject.name,
              e.subject.nameAr || e.subject.name,
              '—',
              '—',
            );
          } else if (e.service) {
            addGroupEntry(
              `svc_noSub_${e.serviceId}`,
              e.studentId,
              contribution,
              e.service.name,
              e.service.name,
              e.service.nameAr || e.service.name,
              '—',
              '—',
            );
          } else {
            addGroupEntry(
              '_no_level',
              e.studentId,
              contribution,
              'بدون مستوى',
              '—',
              '—',
              '—',
              '—',
            );
          }
        }

        // Legacy groups (by student's level/subject)
        for (const student of teacherLegacyStudents) {
          const contribution = legacyContributionByStudent.get(student.id) || 0;

          if (student.level) {
            addGroupEntry(
              student.level.id,
              student.id,
              contribution,
              `${student.level.subject.name} - ${student.level.name}`,
              student.level.subject.name,
              student.level.subject.nameAr || student.level.subject.name,
              student.level.name,
              student.level.nameAr || student.level.name,
            );
          } else {
            addGroupEntry(
              '_no_level',
              student.id,
              contribution,
              'بدون مستوى',
              '—',
              '—',
              '—',
              '—',
            );
          }
        }

        const groups = Array.from(groupData.entries()).map(
          ([key, data]) => ({
            ...data,
            studentCount: groupStudentSets.get(key)?.size || 0,
            collected: Math.round(data.collected * 100) / 100,
          }),
        );

        // --- Student details ---
        // For enrollment students: aggregate across all their enrollments with this teacher
        const enrollmentStudentMap = new Map<
          string,
          {
            studentId: string;
            studentName: string;
            levelNameAr: string;
            subjectNameAr: string;
            monthlyAmount: number;
          }
        >();

        for (const e of teacherEnrollments) {
          if (!e.student) continue;
          const contribution = contributionByEnrollment.get(e.id) || 0;
          const existing = enrollmentStudentMap.get(e.studentId);
          if (existing) {
            existing.monthlyAmount += contribution;
          } else {
            enrollmentStudentMap.set(e.studentId, {
              studentId: e.studentId,
              studentName: e.student.fullName,
              levelNameAr: e.level?.nameAr || '—',
              subjectNameAr: e.subject?.nameAr || e.service?.nameAr || '—',
              monthlyAmount: contribution,
            });
          }
        }

        const studentDetails = [
          ...Array.from(enrollmentStudentMap.values()),
          ...teacherLegacyStudents.map((student) => ({
            studentId: student.id,
            studentName: student.fullName,
            levelNameAr: student.level?.nameAr || '—',
            subjectNameAr: student.level?.subject?.nameAr || '—',
            monthlyAmount: Math.round(
              (legacyContributionByStudent.get(student.id) || 0) * 100,
            ) / 100,
          })),
        ]
          .map((d) => ({
            ...d,
            monthlyAmount: Math.round(d.monthlyAmount * 100) / 100,
            paid: d.monthlyAmount > 0,
          }))
          .sort((a, b) => b.monthlyAmount - a.monthlyAmount);

        return {
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          teacherPhone: teacher.phone,
          teacherPercentage: percentage,
          totalStudents,
          totalCollected: Math.round(totalCollected * 100) / 100,
          teacherShare: Math.round(teacherShare * 100) / 100,
          groups,
          studentDetails,
        };
      });

      return NextResponse.json(calculations);
    }

    // Normal mode: return teacher payments list
    const where: Record<string, unknown> = {};

    if (teacherId) {
      where.teacherId = teacherId;
    }
    if (month) {
      where.month = month;
    }
    if (year) {
      where.year = parseInt(year);
    }
    if (status) {
      where.status = status;
    }

    const teacherPayments = await db.teacherPayment.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        teacher: {
          include: {
            subjects: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(teacherPayments);
  } catch (error) {
    console.error('Error fetching teacher payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teacher payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const teacherPayment = await db.teacherPayment.create({
      data: {
        teacherId: body.teacherId,
        amount: body.amount,
        month: body.month,
        year: body.year,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
        notes: body.notes,
        status: body.status || 'pending',
      },
      include: {
        teacher: {
          include: {
            subjects: {
              include: {
                subject: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(teacherPayment, { status: 201 });
  } catch (error) {
    console.error('Error creating teacher payment:', error);
    return NextResponse.json(
      { error: 'Failed to create teacher payment' },
      { status: 500 }
    );
  }
}