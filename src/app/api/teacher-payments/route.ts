import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper: get previous month number and year (handles year boundary)
function getPrevMonth(month: number, year: number): { month: number; year: number } {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
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

      // Build where clause for students
      const studentWhere: Record<string, unknown> = { status: 'active' };
      if (specificTeacherId) {
        studentWhere.teacherId = specificTeacherId;
      }

      // Fetch all relevant students with their levels
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

      // Fetch all teachers (or specific one)
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

      // The month/year being calculated (from form selection, defaults to current)
      const calcMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const calcYear = year ? parseInt(year) : new Date().getFullYear();

      // =============================================
      // TEACHER PAYMENT PERIOD LOGIC:
      // When a student pays between 1st-15th → teacher gets paid next month
      // When a student pays between 16th-end → teacher gets paid the month after next
      //
      // So for calcMonth/calcYear, we need:
      //   Period 1: payments from (calcMonth-1) where paymentDate day is 1-15
      //   Period 2: payments from (calcMonth-2) where paymentDate day is 16-end
      // =============================================

      const prev = getPrevMonth(calcMonth, calcYear);           // M-1
      const prevPrev = getPrevMonth(prev.month, prev.year);     // M-2

      // Period 1 date range: 1st to 15th of previous month
      const period1Start = new Date(prev.year, prev.month - 1, 1, 0, 0, 0, 0);
      const period1End = new Date(prev.year, prev.month - 1, 15, 23, 59, 59, 999);

      // Period 2 date range: 16th to end of month before previous
      const period2Start = new Date(prevPrev.year, prevPrev.month - 1, 16, 0, 0, 0, 0);
      const lastDayPrevPrev = getLastDayOfMonth(prevPrev.month, prevPrev.year);
      const period2End = new Date(prevPrev.year, prevPrev.month - 1, lastDayPrevPrev, 23, 59, 59, 999);

      // Pre-fetch all qualifying payments from ALL active students
      const allStudentIds = students.map((s) => s.id);
      const studentPayments = allStudentIds.length > 0
        ? await db.payment.findMany({
            where: {
              studentId: { in: allStudentIds },
              status: { in: ['paid', 'partial'] },
              paymentDate: {
                gte: period2Start,
                lte: period1End,
              },
            },
            include: {
              student: {
                select: { id: true, fullName: true, level: true },
              },
            },
          })
        : [];

      // Classify each payment into its period and build map
      // Map: studentId → { totalPaid, period1Paid, period2Paid, paymentCount }
      const paidByStudent = new Map<string, {
        totalPaid: number;
        period1Paid: number;
        period2Paid: number;
        period: 'period1' | 'period2' | 'both';
        paymentDate: Date | null;
      }>();

      for (const p of studentPayments) {
        const existing = paidByStudent.get(p.studentId);
        const pDate = p.paymentDate ? new Date(p.paymentDate) : null;

        if (existing && pDate) {
          existing.totalPaid += (p.paidAmount || 0);
          if (pDate >= period1Start && pDate <= period1End) {
            existing.period1Paid += (p.paidAmount || 0);
          }
          if (pDate >= period2Start && pDate <= period2End) {
            existing.period2Paid += (p.paidAmount || 0);
          }
          // Determine overall period
          if (existing.period1Paid > 0 && existing.period2Paid > 0) {
            existing.period = 'both';
          }
        } else if (pDate) {
          const isPeriod1 = pDate >= period1Start && pDate <= period1End;
          const isPeriod2 = pDate >= period2Start && pDate <= period2End;
          paidByStudent.set(p.studentId, {
            totalPaid: p.paidAmount || 0,
            period1Paid: isPeriod1 ? (p.paidAmount || 0) : 0,
            period2Paid: isPeriod2 ? (p.paidAmount || 0) : 0,
            period: isPeriod1 ? 'period1' : 'period2',
            paymentDate: pDate,
          });
        }
      }

      // Calculate data for each teacher
      const calculations = teachers.map((teacher) => {
        // Students assigned to this teacher who have qualifying payments
        const teacherStudentsWithPayments = students.filter(
          (s) => s.teacherId === teacher.id && paidByStudent.has(s.id)
        );

        const totalStudents = teacherStudentsWithPayments.length;

        // Sum the actual paidAmount from qualifying Payment records
        const totalCollected = teacherStudentsWithPayments.reduce((sum, student) => {
          return sum + (paidByStudent.get(student.id)?.totalPaid || 0);
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

        teacherStudentsWithPayments.forEach((student) => {
          const studentPaid = paidByStudent.get(student.id)?.totalPaid || 0;
          if (student.level) {
            const key = student.level.id;
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
              existing.collected += studentPaid;
            } else {
              groupsMap.set(key, {
                groupName: `${student.level.subject.name} - ${student.level.name}`,
                subjectName: student.level.subject.name,
                subjectNameAr: student.level.subject.nameAr || student.level.subject.name,
                levelName: student.level.name,
                levelNameAr: student.level.nameAr || student.level.name,
                studentCount: 1,
                collected: studentPaid,
              });
            }
          } else {
            const key = '_no_level';
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
              existing.collected += studentPaid;
            } else {
              groupsMap.set(key, {
                groupName: 'بدون مستوى',
                subjectName: '—',
                subjectNameAr: '—',
                levelName: '—',
                levelNameAr: '—',
                studentCount: 1,
                collected: studentPaid,
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
          // Include period info for display
          periodInfo: {
            calcMonth,
            calcYear,
            period1: {
              month: prev.month,
              year: prev.year,
              range: `1-${prev.month <= 7 ? [31,28,31,30,31,30,31][prev.month-1] : [31,31,30,31,30,31][prev.month-8]} ${prev.month}`,
            },
            period2: {
              month: prevPrev.month,
              year: prevPrev.year,
              range: `16-${lastDayPrevPrev} ${prevPrev.month}`,
            },
          },
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
