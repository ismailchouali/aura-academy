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
    const subjects = teacher.subjects
      ? teacher.subjects.map((ts) => ts.subject.nameAr || ts.subject.name).join(' ، ')
      : '—';

    const paymentDate = payment.paymentDate
      ? new Date(payment.paymentDate)
      : new Date();
    const day = paymentDate.getDate();
    const month = paymentDate.getMonth() + 1;
    const year = paymentDate.getFullYear();

    const amountStr = (payment.amount || 0).toLocaleString('fr-MA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const monthStr = getMonthName(payment.month);
    const yearStr = String(payment.year);

    // Fetch calc data for groups/student details
    let groups: { subjectNameAr: string; levelNameAr: string; studentCount: number }[] = [];
    let paidStudents: { studentName: string; subjectNameAr: string; levelNameAr: string; monthlyAmount: number }[] = [];
    let totalStudents = 0;

    try {
      const calcParams = new URLSearchParams({
        calculate: 'true',
        teacherId: payment.teacherId,
        month: payment.month,
        year: String(payment.year),
      });
      // Internal fetch to our own API
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';
      const calcRes = await fetch(`${baseUrl}/api/teacher-payments?${calcParams.toString()}`);
      if (calcRes.ok) {
        const calcData = await calcRes.json();
        const teacherCalc = Array.isArray(calcData)
          ? calcData.find((c: { teacherId: string }) => c.teacherId === payment.teacherId)
          : null;

        if (teacherCalc) {
          groups = teacherCalc.groups || [];
          totalStudents = teacherCalc.totalStudents || groups.reduce((s: number, g: { studentCount: number }) => s + g.studentCount, 0);

          const studentDetails = teacherCalc.studentDetails || [];
          paidStudents = studentDetails
            .filter((s: { paid: boolean }) => s.paid)
            .map((s: { studentName: string; subjectNameAr: string; levelNameAr: string; monthlyAmount: number }) => ({
              studentName: s.studentName,
              subjectNameAr: s.subjectNameAr || '—',
              levelNameAr: s.levelNameAr || '—',
              monthlyAmount: s.monthlyAmount,
            }));
        }
      }
    } catch {
      // calc data fetch failed, show bon without details
    }

    const totalPaidByStudents = paidStudents.reduce((s, st) => s + st.monthlyAmount, 0);

    // Build groups table HTML
    let groupsTableHTML = '';
    if (groups.length > 0) {
      groupsTableHTML = `
        <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:12px;">
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

    // Build students table HTML
    let studentsTableHTML = '';
    if (paidStudents.length > 0) {
      studentsTableHTML = `
        <div class="bon-students">
          <h3>تفاصيل المدفوعات - التلاميذ</h3>
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
                  <td style="border:1px solid #d1d5db; padding:4px 8px; text-align:center; font-weight:600; color:#059669;">${s.monthlyAmount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <tr style="background:#f0fdfa; font-weight:700;">
                <td colspan="3" style="border:1px solid #d1d5db; padding:5px 8px; text-align:right;">المجموع</td>
                <td style="border:1px solid #d1d5db; padding:5px 8px; text-align:center; color:#059669;">${totalPaidByStudents.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    }

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>بون دفع أستاذ - ${teacherName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
  @page { size: A4; margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Tajawal', 'Segoe UI', 'Arial', sans-serif;
    background: white;
    display: flex;
    justify-content: center;
    padding: 15px;
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
  .bon-header {
    background: white;
    color: #0d9488;
    text-align: center;
    padding: 14px 20px;
    border-bottom: 2px solid #0d9488;
  }
  .bon-header h1 {
    font-size: 20px;
    font-weight: 700;
    margin-top: 8px;
    margin-bottom: 0;
  }
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
  .bon-info {
    padding: 12px 20px;
    border-bottom: 1px solid #e2e8f0;
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
  .bon-groups {
    padding: 8px 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  .bon-groups h3 {
    font-size: 12px;
    color: #0d9488;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .bon-students {
    padding: 8px 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  .bon-students h3 {
    font-size: 12px;
    color: #0d9488;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .amount-box {
    background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
    margin: 12px 20px;
    padding: 14px;
    border-radius: 8px;
    border: 1px solid #99f6e4;
    text-align: center;
  }
  .amount-label { font-size: 11px; color: #64748b; margin-bottom: 2px; }
  .amount-value {
    font-size: 26px;
    font-weight: 800;
    color: #0f766e;
    direction: ltr;
  }
  .amount-currency { font-size: 13px; color: #0d9488; font-weight: 500; }
  .bon-details {
    padding: 10px 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  .bon-details h3 {
    font-size: 11px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .bon-footer {
    padding: 12px 20px 14px;
    text-align: center;
    font-size: 11px;
    color: #64748b;
    line-height: 1.8;
    border-top: 1px solid #e2e8f0;
  }
  .bon-footer .phone-line {
    font-weight: 600;
    direction: ltr;
    display: inline-block;
  }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="bon-container">
    <div class="bon-header">
      <h1>Aura Academy</h1>
    </div>

    <div class="bon-title-bar">
      <h2>بون دفع أستاذ / سند دفع</h2>
    </div>

    <div class="bon-info">
      <div class="info-row">
        <span class="info-label">اسم الأستاذ</span>
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

    ${groups.length > 0 ? `
    <div class="bon-groups">
      <h3>توزيع التلاميذ حسب المجموعات</h3>
      ${groupsTableHTML}
    </div>` : ''}

    ${studentsTableHTML}

    <div class="amount-box">
      <div class="amount-label">المبلغ المستحق</div>
      <div class="amount-value">${amountStr} <span class="amount-currency">درهم</span></div>
    </div>

    <div class="bon-details">
      <h3>تفاصيل الدفع</h3>
      <div class="info-row">
        <span class="info-label">الشهر</span>
        <span class="info-value">${monthStr} ${yearStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">تاريخ الدفع</span>
        <span class="info-value" dir="ltr">${day} / ${month} / ${year}</span>
      </div>
      ${payment.notes ? `
      <div class="info-row">
        <span class="info-label">ملاحظات</span>
        <span class="info-value">${payment.notes}</span>
      </div>` : ''}
    </div>

    <div class="bon-footer">
      <div class="phone-line">الهاتف: 0606030356</div>
      <div>Bd med V, N°407 Route de Marrakech, Béni Mellal</div>
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
