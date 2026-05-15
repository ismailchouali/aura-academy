import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
];

function getMonthName(month: string): string {
  const idx = parseInt(month) - 1;
  return idx >= 0 && idx < 12 ? MONTH_NAMES_AR[idx] : month;
}

// Helper: get next month number and year (handles year boundary)
function getNextMonth(month: number, year: number): { month: number; year: number } {
  if (month === 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

// Helper: add N months
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

function isSameMonth(a: { month: number; year: number }, b: { month: number; year: number }): boolean {
  return a.month === b.month && a.year === b.year;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('id');

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment id' }, { status: 400 });
    }

    // Fetch payment with teacher info
    const payment = await db.teacherPayment.findUnique({
      where: { id: paymentId },
      include: {
        teacher: {
          include: {
            subjects: {
              include: { subject: true },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const teacher = payment.teacher;
    const teacherName = teacher.fullName || '—';
    const teacherPhone = teacher.phone || '—';
    const teacherPercentage = teacher.percentage || 0;
    const subjects = teacher.subjects
      ? teacher.subjects.map((ts) => ts.subject.nameAr || ts.subject.name).join(' ، ')
      : '—';

    const paymentDate = payment.paymentDate
      ? new Date(payment.paymentDate)
      : new Date();
    const day = paymentDate.getDate();
    const month = paymentDate.getMonth() + 1;
    const year = paymentDate.getFullYear();

    // The month/year of this teacher payment (month the teacher worked)
    const calcMonth = parseInt(payment.month);
    const calcYear = payment.year;

    const monthStr = getMonthName(payment.month);
    const yearStr = String(payment.year);

    // ─── Inline calculation (no self-fetch) ────────────────────
    // Fetch all active students for this teacher with levels
    const teacherStudents = await db.student.findMany({
      where: {
        teacherId: teacher.id,
        status: 'active',
      },
      include: {
        level: {
          include: {
            subject: { include: { service: true } },
          },
        },
      },
    });

    const totalStudents = teacherStudents.length;

    // Fetch all relevant payments for these students
    const allStudentIds = teacherStudents.map((s) => s.id);
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

    // Calculate monthly contribution per student for this calcMonth
    // Using the coverage algorithm:
    // - Paid 1st-15th → effective start = next month
    // - Paid 16th-end → effective start = month after next
    // - Pack covers N months starting from effective start
    const monthlyContributionByStudent = new Map<string, number>();

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

      for (let i = 0; i < packMonths; i++) {
        const coveredMonth = addMonths(effectiveStart.month, effectiveStart.year, i);
        if (isSameMonth(coveredMonth, { month: calcMonth, year: calcYear })) {
          const existing = monthlyContributionByStudent.get(p.studentId) || 0;
          monthlyContributionByStudent.set(p.studentId, existing + monthlyAmount);
          break;
        }
      }
    }

    // Build student detail list
    const studentDetails = teacherStudents
      .map((student) => {
        const contribution = monthlyContributionByStudent.get(student.id) || 0;
        return {
          studentId: student.id,
          studentName: student.fullName,
          levelNameAr: student.level?.nameAr || '—',
          subjectNameAr: student.level?.subject?.nameAr || '—',
          monthlyAmount: Math.round(contribution * 100) / 100,
          paid: contribution > 0,
        };
      })
      .sort((a, b) => a.paid === b.paid ? 0 : a.paid ? -1 : 1);

    // Groups breakdown by level
    const groupsMap = new Map<string, { subjectNameAr: string; levelNameAr: string; studentCount: number; collected: number }>();

    teacherStudents.forEach((student) => {
      const contribution = monthlyContributionByStudent.get(student.id) || 0;
      if (student.level) {
        const key = student.level.id;
        const existing = groupsMap.get(key);
        if (existing) {
          existing.studentCount += 1;
          existing.collected += contribution;
        } else {
          groupsMap.set(key, {
            subjectNameAr: student.level.subject?.nameAr || '—',
            levelNameAr: student.level.nameAr || '—',
            studentCount: 1,
            collected: contribution,
          });
        }
      } else {
        const key = '_no_level';
        const existing = groupsMap.get(key);
        if (existing) {
          existing.studentCount += 1;
          existing.collected += contribution;
        } else {
          groupsMap.set(key, {
            subjectNameAr: '—',
            levelNameAr: '—',
            studentCount: 1,
            collected: contribution,
          });
        }
      }
    });

    const groups = Array.from(groupsMap.values());
    const totalCollected = Math.round(studentDetails.reduce((s, st) => s + st.monthlyAmount, 0) * 100) / 100;
    const teacherShare = Math.round((totalCollected * teacherPercentage) / 100 * 100) / 100;

    // ─── Build HTML ──────────────────────────────────────────────

    // Groups summary table
    let groupsTableHTML = '';
    if (groups.length > 0) {
      groupsTableHTML = `
        <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:12px;">
          <thead>
            <tr style="background:#f0fdfa;">
              <th style="border:1px solid #d1d5db; padding:6px 10px; text-align:right; font-weight:600;">#</th>
              <th style="border:1px solid #d1d5db; padding:6px 10px; text-align:right; font-weight:600;">المستوى</th>
              <th style="border:1px solid #d1d5db; padding:6px 10px; text-align:center; font-weight:600;">عدد التلاميذ</th>
            </tr>
          </thead>
          <tbody>
            ${groups.map((g, i) => `
              <tr>
                <td style="border:1px solid #d1d5db; padding:5px 10px; text-align:right;">${i + 1}</td>
                <td style="border:1px solid #d1d5db; padding:5px 10px; text-align:right;">${g.subjectNameAr} - ${g.levelNameAr}</td>
                <td style="border:1px solid #d1d5db; padding:5px 10px; text-align:center; font-weight:600;">${g.studentCount}</td>
              </tr>
            `).join('')}
            <tr style="background:#f0fdfa; font-weight:700;">
              <td colspan="2" style="border:1px solid #d1d5db; padding:6px 10px; text-align:right;">المجموع</td>
              <td style="border:1px solid #d1d5db; padding:6px 10px; text-align:center;">${totalStudents}</td>
            </tr>
          </tbody>
        </table>`;
    }

    // Student details table (only students with contribution)
    const paidStudents = studentDetails.filter((s) => s.paid);
    let studentsTableHTML = '';
    if (paidStudents.length > 0) {
      studentsTableHTML = `
        <h3 style="font-size:12px; color:#0d9488; font-weight:700; margin-bottom:4px;">تفاصيل المدفوعات - التلاميذ</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:11px;">
          <thead>
            <tr style="background:#f0fdfa;">
              <th style="border:1px solid #d1d5db; padding:5px 8px; text-align:right; font-weight:600; font-size:10px;">#</th>
              <th style="border:1px solid #d1d5db; padding:5px 8px; text-align:right; font-weight:600; font-size:10px;">اسم التلميذ</th>
              <th style="border:1px solid #d1d5db; padding:5px 8px; text-align:right; font-weight:600; font-size:10px;">المستوى</th>
              <th style="border:1px solid #d1d5db; padding:5px 8px; text-align:center; font-weight:600; font-size:10px;">المبلغ (درهم)</th>
            </tr>
          </thead>
          <tbody>
            ${paidStudents.map((s, i) => `
              <tr>
                <td style="border:1px solid #d1d5db; padding:4px 8px; text-align:right;">${i + 1}</td>
                <td style="border:1px solid #d1d5db; padding:4px 8px; text-align:right; font-weight:500;">${s.studentName}</td>
                <td style="border:1px solid #d1d5db; padding:4px 8px; text-align:right; font-size:10px; color:#64748b;">${s.subjectNameAr} - ${s.levelNameAr}</td>
                <td style="border:1px solid #d1d5db; padding:4px 8px; text-align:center; font-weight:600; color:#059669;">${formatMoney(s.monthlyAmount)}</td>
              </tr>
            `).join('')}
            <tr style="background:#f0fdfa; font-weight:700;">
              <td colspan="3" style="border:1px solid #d1d5db; padding:5px 8px; text-align:right;">المجموع</td>
              <td style="border:1px solid #d1d5db; padding:5px 8px; text-align:center; color:#059669;">${formatMoney(totalCollected)}</td>
            </tr>
          </tbody>
        </table>`;
    }

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>بون دفع أستاذ - ${teacherName}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    background: white;
    display: flex;
    justify-content: center;
    padding: 10px;
    font-size: 13px;
    color: #1e293b;
  }
  .bon-container {
    width: 100%;
    max-width: 700px;
    border: 2px solid #0d9488;
    border-radius: 8px;
    overflow: hidden;
    background: white;
  }

  /* Header */
  .bon-header {
    background: white;
    text-align: center;
    padding: 12px 20px;
    border-bottom: 2px solid #0d9488;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .bon-header .logo-area {
    flex: 1;
    text-align: right;
  }
  .bon-header .logo-area img {
    height: 50px;
  }
  .bon-header .title-area {
    flex: 2;
    text-align: center;
  }
  .bon-header .title-area h1 {
    font-size: 20px;
    font-weight: 700;
    color: #0d9488;
    margin-bottom: 2px;
  }
  .bon-header .title-area .subtitle {
    font-size: 10px;
    color: #64748b;
  }
  .bon-header .contact-area {
    flex: 1;
    text-align: left;
    font-size: 10px;
    color: #64748b;
    line-height: 1.6;
  }

  /* Title bar */
  .bon-title-bar {
    background: #f0fdfa;
    text-align: center;
    padding: 8px;
    border-bottom: 2px solid #0d9488;
  }
  .bon-title-bar h2 {
    font-size: 15px;
    font-weight: 700;
    color: #0d9488;
  }

  /* Info grid */
  .bon-info {
    padding: 12px 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 20px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    font-size: 12px;
    border-bottom: 1px dashed #f1f5f9;
  }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #64748b; }
  .info-value { font-weight: 600; color: #1e293b; }

  /* Sections */
  .bon-section {
    padding: 10px 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  .bon-section h3 {
    font-size: 12px;
    color: #0d9488;
    font-weight: 700;
    margin-bottom: 4px;
  }

  /* Amount boxes */
  .amount-row {
    display: flex;
    gap: 12px;
    padding: 10px 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  .amount-box {
    flex: 1;
    background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
    padding: 14px;
    border-radius: 8px;
    border: 1px solid #99f6e4;
    text-align: center;
  }
  .amount-box.teacher-box {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border-color: #fde68a;
  }
  .amount-label { font-size: 11px; color: #64748b; margin-bottom: 2px; }
  .amount-value {
    font-size: 22px;
    font-weight: 800;
    color: #0f766e;
    direction: ltr;
  }
  .amount-box.teacher-box .amount-value {
    color: #b45309;
  }
  .amount-currency { font-size: 12px; color: #0d9488; font-weight: 500; }
  .amount-box.teacher-box .amount-currency { color: #b45309; }
  .percentage-badge {
    display: inline-block;
    background: #0d9488;
    color: white;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    margin-top: 4px;
  }
  .amount-box.teacher-box .percentage-badge {
    background: #b45309;
  }

  /* Footer */
  .bon-footer {
    padding: 10px 20px 12px;
    font-size: 11px;
    color: #64748b;
    line-height: 1.8;
    border-top: 1px solid #e2e8f0;
  }
  .footer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-left {
    text-align: right;
  }
  .footer-right {
    text-align: left;
    font-size: 10px;
    line-height: 1.6;
  }
  .footer-right .phone-line {
    font-weight: 600;
    direction: ltr;
  }

  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="bon-container">
    <!-- Header -->
    <div class="bon-header">
      <div class="logo-area">
        <img src="/logo.png" alt="Logo" onerror="this.style.display='none'">
      </div>
      <div class="title-area">
        <h1>Aura Academy</h1>
        <div class="subtitle">Goethe, ÖSD, TELC, اللغة الألمانية</div>
      </div>
      <div class="contact-area">
        <div>0657204020</div>
      </div>
    </div>

    <!-- Title -->
    <div class="bon-title-bar">
      <h2>بون دفع أستاذ / سند دفع</h2>
    </div>

    <!-- Teacher Info -->
    <div class="bon-info">
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">اسم الأستاذة</span>
          <span class="info-value">${teacherName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">الهاتف</span>
          <span class="info-value" dir="ltr">${teacherPhone}</span>
        </div>
        <div class="info-row">
          <span class="info-label">المواد</span>
          <span class="info-value" style="font-size:11px;">${subjects}</span>
        </div>
        <div class="info-row">
          <span class="info-label">التاريخ</span>
          <span class="info-value" dir="ltr">${day} / ${month} / ${year}</span>
        </div>
      </div>
    </div>

    <!-- Groups Summary -->
    ${groups.length > 0 ? `
    <div class="bon-section">
      <h3>توزيع التلاميذ</h3>
      ${groupsTableHTML}
    </div>` : ''}

    <!-- Student Details -->
    ${paidStudents.length > 0 ? `
    <div class="bon-section">
      ${studentsTableHTML}
    </div>` : ''}

    <!-- Amount Boxes -->
    <div class="amount-row">
      <div class="amount-box">
        <div class="amount-label">إجمالي المدفوعات المستفادة</div>
        <div class="amount-value">${formatMoney(totalCollected)} <span class="amount-currency">درهم</span></div>
      </div>
      <div class="amount-box teacher-box">
        <div class="amount-label">حصة المستفيدة (دريهم)</div>
        <div class="amount-value">${formatMoney(teacherShare)} <span class="amount-currency">درهم</span></div>
        <div class="percentage-badge">${teacherPercentage}%</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="bon-footer">
      <div class="footer-row">
        <div class="footer-left">
          <span class="info-label">الشهر: </span>
          <span class="info-value">${monthStr} ${yearStr}</span>
          &nbsp;&nbsp;
          <span class="info-label">تاريخ الدفع: </span>
          <span class="info-value" dir="ltr">${day} / ${month} / ${year}</span>
        </div>
        <div class="footer-right">
          <div class="phone-line">0606030356</div>
          <div>Bd med V, N°407 Route de Marrakech, Béni Mellal</div>
        </div>
      </div>
    </div>
  </div>

  <div class="no-print" style="text-align:center; margin-top:12px;">
    <button onclick="window.print()" style="padding:8px 24px; background:#0d9488; color:white; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-size:14px;">طباعة</button>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating bon:', error);
    return NextResponse.json({ error: 'Failed to generate bon' }, { status: 500 });
  }
}
