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

      // Fetch ALL active students
      const students = await db.student.findMany({
        where: { status: 'active' },
        include: {
          level: {
            include: {
              subject: { include: { service: true } },
            },
          },
          teacher: true,
        },
      });

      // Fetch all active teachers (or specific one)
      const teacherWhere: Record<string, unknown> = { status: 'active' };
      if (specificTeacherId) {
        teacherWhere.id = specificTeacherId;
      }

      const teachers = await db.teacher.findMany({
        where: Object.keys(teacherWhere).length > 0 ? teacherWhere : undefined,
        include: {
          subjects: {
            include: {
              subject: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // The month/year being calculated (from form selection)
      const calcMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const calcYear = year ? parseInt(year) : new Date().getFullYear();

      // Fetch ALL active enrollments for these students
      const studentIds = students.map((s) => s.id);
      const allEnrollments = studentIds.length > 0
        ? await db.studentEnrollment.findMany({
            where: {
              studentId: { in: studentIds },
              status: 'active',
            },
            include: {
              service: true,
              subject: true,
              level: true,
              teacher: true,
            },
          })
        : [];

      // Fetch ALL payments that are linked to these enrollments
      const enrollmentIds = allEnrollments.map(e => e.id);
      const enrollmentPayments = enrollmentIds.length > 0
        ? await db.payment.findMany({
            where: {
              enrollmentId: { in: enrollmentIds },
              status: { in: ['paid', 'partial'] },
              paidAmount: { gt: 0 },
            },
          })
        : [];

      // Also fetch legacy payments (no enrollmentId) for students
      const legacyPayments = studentIds.length > 0
        ? await db.payment.findMany({
            where: {
              studentId: { in: studentIds },
              enrollmentId: null,
              status: { in: ['paid', 'partial'] },
              paidAmount: { gt: 0 },
            },
          })
        : [];

      // Build maps
      const paymentsByEnrollment = new Map<string, typeof enrollmentPayments>();
      for (const p of enrollmentPayments) {
        if (p.enrollmentId) {
          const list = paymentsByEnrollment.get(p.enrollmentId);
          if (list) { list.push(p); } else { paymentsByEnrollment.set(p.enrollmentId, [p]); }
        }
      }

      const paymentsByStudent = new Map<string, typeof legacyPayments>();
      for (const p of legacyPayments) {
        const list = paymentsByStudent.get(p.studentId);
        if (list) { list.push(p); } else { paymentsByStudent.set(p.studentId, [p]); }
      }

      // Group enrollments by teacherId
      const enrollmentsByTeacher = new Map<string, typeof allEnrollments>();
      for (const e of allEnrollments) {
        if (e.teacherId) {
          const list = enrollmentsByTeacher.get(e.teacherId);
          if (list) { list.push(e); } else { enrollmentsByTeacher.set(e.teacherId, [e]); }
        }
      }

      // Also group legacy students (those with student.teacherId but no enrollment for that teacher)
      const studentsByTeacher = new Map<string, typeof students>();
      for (const s of students) {
        if (s.teacherId) {
          const list = studentsByTeacher.get(s.teacherId);
          if (list) { list.push(s); } else { studentsByTeacher.set(s.teacherId, [s]); }
        }
      }

      // Calculate data for each teacher
      const calculations = teachers.map((teacher) => {
        // ENROLLMENT-based students for this teacher
        const teacherEnrollments = enrollmentsByTeacher.get(teacher.id) || [];

        // Build monthly contribution per enrollment for calcMonth
        const monthlyContributionByEnrollment = new Map<string, number>();

        for (const enrollment of teacherEnrollments) {
          const ePayments = paymentsByEnrollment.get(enrollment.id) || [];

          for (const p of ePayments) {
            const pDate = p.paymentDate ? new Date(p.paymentDate) : null;
            if (!pDate) continue;

            const packMonths = p.packMonths || 1;
            const monthlyAmount = (p.paidAmount || 0) / packMonths;

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
              if (isSameMonth(coveredMonth, { month: calcMonth, year: calcYear })) {
                const existing = monthlyContributionByEnrollment.get(enrollment.id) || 0;
                monthlyContributionByEnrollment.set(enrollment.id, existing + monthlyAmount);
                break;
              }
            }
          }
        }

        // Legacy students for this teacher (who don't have an enrollment under this teacher)
        const allEnrolledStudentIds = new Set(
          teacherEnrollments.map(e => e.studentId)
        );
        const legacyTeacherStudents = (studentsByTeacher.get(teacher.id) || [])
          .filter(s => !allEnrolledStudentIds.has(s.id));

        // Build monthly contribution for legacy students
        const monthlyContributionByLegacyStudent = new Map<string, number>();

        for (const student of legacyTeacherStudents) {
          const sPayments = paymentsByStudent.get(student.id) || [];

          for (const p of sPayments) {
            const pDate = p.paymentDate ? new Date(p.paymentDate) : null;
            if (!pDate) continue;

            const packMonths = p.packMonths || 1;
            const monthlyAmount = (p.paidAmount || 0) / packMonths;

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
              if (isSameMonth(coveredMonth, { month: calcMonth, year: calcYear })) {
                const existing = monthlyContributionByLegacyStudent.get(student.id) || 0;
                monthlyContributionByLegacyStudent.set(student.id, existing + monthlyAmount);
                break;
              }
            }
          }
        }

        // Total students = enrollment count + legacy student count
        const totalStudents = teacherEnrollments.length + legacyTeacherStudents.length;

        // Total collected from enrollments
        const enrollmentCollected = teacherEnrollments.reduce((sum, e) => {
          return sum + (monthlyContributionByEnrollment.get(e.id) || 0);
        }, 0);

        // Total collected from legacy students
        const legacyCollected = legacyTeacherStudents.reduce((sum, s) => {
          return sum + (monthlyContributionByLegacyStudent.get(s.id) || 0);
        }, 0);

        const totalCollected = enrollmentCollected + legacyCollected;

        // Teacher share
        const percentage = teacher.percentage || 0;
        const teacherShare = (totalCollected * percentage) / 100;

        // Groups breakdown: group by enrollment's subject/level
        const groupsMap = new Map<
          string,
          {
            groupName: string;
            subjectName: string;
            subjectNameAr: string;
            levelName: string;
            levelNameAr: string;
            studentCount: number;
            collected: number;
          }
        >();

        // Add enrollment-based groups
        const studentById = new Map(students.map(s => [s.id, s]));
        teacherEnrollments.forEach((enrollment) => {
          const contribution = monthlyContributionByEnrollment.get(enrollment.id) || 0;
          const student = studentById.get(enrollment.studentId);

          if (enrollment.level && enrollment.subject) {
            const key = enrollment.level.id;
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
              existing.collected += contribution;
            } else {
              groupsMap.set(key, {
                groupName: `${enrollment.subject.name} - ${enrollment.level.name}`,
                subjectName: enrollment.subject.name,
                subjectNameAr: enrollment.subject.nameAr || enrollment.subject.name,
                levelName: enrollment.level.name,
                levelNameAr: enrollment.level.nameAr || enrollment.level.name,
                studentCount: 1,
                collected: contribution,
              });
            }
          } else if (enrollment.subject) {
            const key = `_${enrollment.subject.id}_no_level`;
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
              existing.collected += contribution;
            } else {
              groupsMap.set(key, {
                groupName: enrollment.subject.nameAr || enrollment.subject.name,
                subjectName: enrollment.subject.name,
                subjectNameAr: enrollment.subject.nameAr || enrollment.subject.name,
                levelName: '—',
                levelNameAr: '—',
                studentCount: 1,
                collected: contribution,
              });
            }
          } else {
            const key = '_no_subject';
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
              existing.collected += contribution;
            } else {
              groupsMap.set(key, {
                groupName: 'بدون مستوى',
                subjectName: '—',
                subjectNameAr: '—',
                levelName: '—',
                levelNameAr: '—',
                studentCount: 1,
                collected: contribution,
              });
            }
          }
        });

        // Add legacy student groups
        legacyTeacherStudents.forEach((student) => {
          const contribution = monthlyContributionByLegacyStudent.get(student.id) || 0;
          if (student.level) {
            const key = `legacy_${student.level.id}`;
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
              existing.collected += contribution;
            } else {
              groupsMap.set(key, {
                groupName: `${student.level.subject.name} - ${student.level.name}`,
                subjectName: student.level.subject.name,
                subjectNameAr: student.level.subject.nameAr || student.level.subject.name,
                levelName: student.level.name,
                levelNameAr: student.level.nameAr || student.level.name,
                studentCount: 1,
                collected: contribution,
              });
            }
          } else {
            const key = '_legacy_no_level';
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
              existing.collected += contribution;
            } else {
              groupsMap.set(key, {
                groupName: 'بدون مستوى',
                subjectName: '—',
                subjectNameAr: '—',
                levelName: '—',
                levelNameAr: '—',
                studentCount: 1,
                collected: contribution,
              });
            }
          }
        });

        const groups = Array.from(groupsMap.values());

        // Build student details list from enrollments
        const enrollmentDetails = teacherEnrollments
          .map((enrollment) => {
            const student = studentById.get(enrollment.studentId);
            if (!student) return null;
            const contribution = monthlyContributionByEnrollment.get(enrollment.id) || 0;
            return {
              studentId: student.id,
              studentName: student.fullName,
              levelNameAr: enrollment.level?.nameAr || '—',
              subjectNameAr: enrollment.subject?.nameAr || '—',
              monthlyAmount: Math.round(contribution * 100) / 100,
              paid: contribution > 0,
            };
          })
          .filter(Boolean) as { studentId: string; studentName: string; levelNameAr: string; subjectNameAr: string; monthlyAmount: number; paid: boolean }[];

        // Build student details list from legacy students
        const legacyDetails = legacyTeacherStudents
          .map((student) => {
            const contribution = monthlyContributionByLegacyStudent.get(student.id) || 0;
            return {
              studentId: student.id,
              studentName: student.fullName,
              levelNameAr: student.level?.nameAr || '—',
              subjectNameAr: student.level?.subject?.nameAr || '—',
              monthlyAmount: Math.round(contribution * 100) / 100,
              paid: contribution > 0,
            };
          });

        const studentDetails = [...enrollmentDetails, ...legacyDetails]
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