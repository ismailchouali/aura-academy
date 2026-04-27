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

      // Fetch ALL active students with their levels and teachers
      const studentWhere: Record<string, unknown> = { status: 'active' };
      if (specificTeacherId) {
        studentWhere.teacherId = specificTeacherId;
      }

      const students = await db.student.findMany({
        where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined,
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

      // =============================================
      // NEW ALGORITHM:
      //
      // 1. totalStudents = ALL active students assigned to teacher
      //    (regardless of whether they have payments or not)
      //
      // 2. For each student's payment:
      //    monthlyAmount = paidAmount / packMonths
      //    effectiveStartMonth = based on paymentDate:
      //      - day 1-15 → start of next month
      //      - day 16-end → start of month after next
      //    The pack covers 'packMonths' consecutive months
      //    starting from effectiveStartMonth
      //
      // 3. If calcMonth falls within the pack's coverage period,
      //    add monthlyAmount to totalCollected
      //
      // Example: Hafsa paid 6300 DH for 9-month pack on April 5
      //   monthlyAmount = 6300/9 = 700 DH/month
      //   effectiveStartMonth = May (day 5 is in 1-15 range)
      //   Pack covers: May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan
      //   So for calcMonth = May: totalCollected += 700
      //   For calcMonth = June: totalCollected += 700 (etc.)
      // =============================================

      // Fetch ALL payments for these students (no date range limit)
      // We need all payments because a 9-month pack paid months ago
      // could still be covering the current calculation month
      const allStudentIds = students.map((s) => s.id);
      const studentPayments = allStudentIds.length > 0
        ? await db.payment.findMany({
            where: {
              studentId: { in: allStudentIds },
              status: { in: ['paid', 'partial'] },
              paidAmount: { gt: 0 },
            },
            include: {
              student: {
                select: { id: true, fullName: true, level: true },
              },
            },
          })
        : [];

      // Build a map: studentId → monthly contribution for calcMonth
      // Each payment contributes monthlyAmount if calcMonth falls in its coverage
      const monthlyContributionByStudent = new Map<string, number>();

      for (const p of studentPayments) {
        const pDate = p.paymentDate ? new Date(p.paymentDate) : null;
        if (!pDate) continue;

        const packMonths = p.packMonths || 1;
        const monthlyAmount = (p.paidAmount || 0) / packMonths;

        // Determine effective start month based on payment date
        const payMonth = pDate.getMonth() + 1;
        const payYear = pDate.getFullYear();
        const payDay = pDate.getDate();

        let effectiveStart: { month: number; year: number };
        if (payDay >= 1 && payDay <= 15) {
          // Paid 1st-15th → teacher gets paid starting next month
          effectiveStart = getNextMonth(payMonth, payYear);
        } else {
          // Paid 16th-end → teacher gets paid starting month after next
          const next = getNextMonth(payMonth, payYear);
          effectiveStart = getNextMonth(next.month, next.year);
        }

        // The pack covers packMonths months starting from effectiveStart
        // Check if calcMonth falls within this range
        for (let i = 0; i < packMonths; i++) {
          const coveredMonth = addMonths(effectiveStart.month, effectiveStart.year, i);
          if (isSameMonth(coveredMonth, { month: calcMonth, year: calcYear })) {
            // This payment contributes to this teacher's calcMonth
            const existing = monthlyContributionByStudent.get(p.studentId) || 0;
            monthlyContributionByStudent.set(p.studentId, existing + monthlyAmount);
            break; // A student might have multiple payments, sum them all
          }
        }
      }

      // Build a map: studentId → array of payments for details
      const paymentsByStudent = new Map<string, { paidAmount: number; monthlyAmount: number; effectiveStart: string; packMonths: number; paymentDate: string }[]>();

      for (const p of studentPayments) {
        const pDate = p.paymentDate ? new Date(p.paymentDate) : null;
        if (!pDate) continue;

        const packMonths = p.packMonths || 1;
        const monthlyAmount = (p.paidAmount || 0) / packMonths;

        const payMonth = pDate.getMonth() + 1;
        const payYear = pDate.getFullYear();
        const payDay = pDate.getDate();

        let effectiveStart: { month: number; year: number };
        if (payDay >= 1 && payDay <= 15) {
          effectiveStart = getNextMonth(payMonth, payYear);
        } else {
          const next = getNextMonth(payMonth, payYear);
          effectiveStart = getNextMonth(next.month, next.year);
        }

        const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليوز','غشت','شتنبر','أكتوبر','نونبر','دجنبر'];
        const startLabel = `${MONTH_NAMES[effectiveStart.month - 1]} ${effectiveStart.year}`;

        const arr = paymentsByStudent.get(p.studentId) || [];
        arr.push({
          paidAmount: p.paidAmount || 0,
          monthlyAmount: Math.round(monthlyAmount * 100) / 100,
          effectiveStart: startLabel,
          packMonths,
          paymentDate: pDate.toISOString().split('T')[0],
        });
        paymentsByStudent.set(p.studentId, arr);
      }

      // Calculate data for each teacher
      const calculations = teachers.map((teacher) => {
        // ALL students assigned to this teacher (not just those with payments)
        const teacherStudents = students.filter(
          (s) => s.teacherId === teacher.id
        );

        const totalStudents = teacherStudents.length;

        // Sum monthly contributions from all students whose payments cover calcMonth
        const totalCollected = teacherStudents.reduce((sum, student) => {
          return sum + (monthlyContributionByStudent.get(student.id) || 0);
        }, 0);

        // Teacher share calculation
        const percentage = teacher.percentage || 0;
        const teacherShare = (totalCollected * percentage) / 100;

        // Groups breakdown: group students by their level/subject
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

        teacherStudents.forEach((student) => {
          const studentContribution = monthlyContributionByStudent.get(student.id) || 0;
          if (student.level) {
            const key = student.level.id;
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
              existing.collected += studentContribution;
            } else {
              groupsMap.set(key, {
                groupName: `${student.level.subject.name} - ${student.level.name}`,
                subjectName: student.level.subject.name,
                subjectNameAr: student.level.subject.nameAr || student.level.subject.name,
                levelName: student.level.name,
                levelNameAr: student.level.nameAr || student.level.name,
                studentCount: 1,
                collected: studentContribution,
              });
            }
          } else {
            const key = '_no_level';
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
              existing.collected += studentContribution;
            } else {
              groupsMap.set(key, {
                groupName: 'بدون مستوى',
                subjectName: '—',
                subjectNameAr: '—',
                levelName: '—',
                levelNameAr: '—',
                studentCount: 1,
                collected: studentContribution,
              });
            }
          }
        });

        const groups = Array.from(groupsMap.values());

        return {
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          teacherPhone: teacher.phone,
          teacherPercentage: percentage,
          totalStudents,
          totalCollected: Math.round(totalCollected * 100) / 100,
          teacherShare: Math.round(teacherShare * 100) / 100,
          groups,
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
