import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const MONTH_NAMES: Record<string, string> = {
  '1': 'يناير', '2': 'فبراير', '3': 'مارس', '4': 'أبريل',
  '5': 'ماي', '6': 'يونيو', '7': 'يوليوز', '8': 'غشت',
  '9': 'شتنبر', '10': 'أكتوبر', '11': 'نونبر', '12': 'دجنبر',
};

function fmt(n: number): string {
  return n.toLocaleString('ar-MA', { minimumFractionDigits: 2 });
}

function fmtDate(d: string | Date | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return '—'; }
}

export async function POST(req: NextRequest) {
  try {
    const { paymentId } = await req.json();
    if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 });

    const payment = await db.teacherPayment.findUnique({
      where: { id: paymentId },
      include: { teacher: true },
    });

    if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const teacher = payment.teacher;
    const monthLabel = MONTH_NAMES[payment.month] || payment.month;
    const netAmount = payment.amount - payment.discount;
    const paymentDate = fmtDate(payment.paymentDate);
    const teacherName = teacher.fullName || 'professeur';

    const { Document, Page, Text, View, StyleSheet, Font, pdf } = await import('@react-pdf/renderer');

    const fontDir = path.join(process.cwd(), 'public', 'fonts');
    Font.register({
      family: 'Tajawal',
      fonts: [
        { src: fs.readFileSync(path.join(fontDir, 'Tajawal-Regular.ttf')), fontWeight: 'normal' },
        { src: fs.readFileSync(path.join(fontDir, 'Tajawal-Bold.ttf')), fontWeight: 'bold' },
      ],
    });
    Font.registerHyphenationCallback((word: string) => word);

    const styles = StyleSheet.create({
      page: { fontFamily: 'Tajawal', padding: 40, fontSize: 12, lineHeight: 1.6 },
      header: { textAlign: 'center', marginBottom: 10 },
      headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#0d9488' },
      divider: { height: 2, backgroundColor: '#0d9488', marginBottom: 20 },
      infoSection: { marginBottom: 20 },
      infoRow: { flexDirection: 'row-reverse', marginBottom: 8 },
      infoLabel: { color: '#64748b', fontWeight: 'bold' },
      infoValue: { color: '#1e293b', fontWeight: 'bold' },
      table: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, marginBottom: 20 },
      tableRow: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 10 },
      tableHeader: { backgroundColor: '#f0fdfa' },
      headerCell: { fontWeight: 'bold', color: '#0d9488', fontSize: 11 },
      cell: { flex: 1, fontSize: 12, textAlign: 'right' },
      cellLeft: { textAlign: 'left' },
      green: { color: '#059669' },
      red: { color: '#dc2626' },
      amber: { color: '#d97706' },
      footer: { marginTop: 40, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', textAlign: 'center' },
      footerText: { fontSize: 11, color: '#475569' },
    });

    const BonDoc = () => (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Aura Academy - وصل دفع أستاذ</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>اسم الأستاذ: </Text>
              <Text style={styles.infoValue}>{teacher.fullName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>الهاتف: </Text>
              <Text style={styles.infoValue}>{teacher.phone || '—'}</Text>
            </View>
          </View>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.cell, styles.headerCell]}>البيان</Text>
              <Text style={[styles.cell, styles.headerCell, styles.cellLeft]}>المبلغ (درهم)</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>المطلوب</Text>
              <Text style={[styles.cell, styles.cellLeft]}>{fmt(payment.amount)}</Text>
            </View>
            {payment.discount > 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.cell}>الخصم</Text>
                <Text style={[styles.cell, styles.cellLeft, styles.amber]}>- {fmt(payment.discount)}</Text>
              </View>
            ) : null}
            <View style={styles.tableRow}>
              <Text style={styles.cell}>المدفوع</Text>
              <Text style={[styles.cell, styles.cellLeft, styles.green]}>{fmt(payment.paidAmount || 0)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>المتبقي</Text>
              <Text style={[styles.cell, styles.cellLeft, styles.red]}>{fmt(payment.remainingAmount || 0)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>الشهر والسنة</Text>
              <Text style={styles.cell}>{monthLabel} {payment.year}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.cell}>تاريخ الدفع</Text>
              <Text style={styles.cell}>{paymentDate}</Text>
            </View>
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Aura Academy</Text>
          </View>
        </Page>
      </Document>
    );

    const pdfBlob = await pdf(<BonDoc />).toBlob();
    const buffer = Buffer.from(await pdfBlob.arrayBuffer());
    const fileName = `bon_${teacherName}_${monthLabel}_${payment.year}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Teacher bon PDF error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
