import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

      // Fetch all relevant students with their levels and payments
      const students = await db.student.findMany({
        where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined,
        include: {
          level: {
            include: {
              subject: { include: { service: true } },
            },
          },
          teacher: true,
          payments: {
            select: {
              paidAmount: true,
              month: true,
              year: true,
            },
          },
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

      // Calculate data for each teacher
      const calculations = teachers.map((teacher) => {
        const teacherStudents = students.filter(
          (s) => s.teacherId === teacher.id
        );

        const totalStudents = teacherStudents.length;

        // Sum all paid amounts from these students' payments
        const totalCollected = teacherStudents.reduce(
          (sum, student) =>
            sum +
            student.payments.reduce(
              (pSum, p) => pSum + (p.paidAmount || 0),
              0
            ),
          0
        );

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
          }
        >();

        teacherStudents.forEach((student) => {
          if (student.level) {
            const key = student.level.id;
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
            } else {
              groupsMap.set(key, {
                groupName: `${student.level.subject.name} - ${student.level.name}`,
                subjectName: student.level.subject.name,
                subjectNameAr: student.level.subject.nameAr || student.level.subject.name,
                levelName: student.level.name,
                levelNameAr: student.level.nameAr || student.level.name,
                studentCount: 1,
              });
            }
          } else {
            const key = '_no_level';
            const existing = groupsMap.get(key);
            if (existing) {
              existing.studentCount += 1;
            } else {
              groupsMap.set(key, {
                groupName: 'بدون مستوى',
                subjectName: '—',
                subjectNameAr: '—',
                levelName: '—',
                levelNameAr: '—',
                studentCount: 1,
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
          totalCollected,
          teacherShare,
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
