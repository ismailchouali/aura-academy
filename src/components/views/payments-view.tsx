'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Receipt,
  Printer,
  Wallet,
  Filter,
  FileText,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────

const MONTHS = [
  { value: 'January', label: 'يناير' },
  { value: 'February', label: 'فبراير' },
  { value: 'March', label: 'مارس' },
  { value: 'April', label: 'أبريل' },
  { value: 'May', label: 'ماي' },
  { value: 'June', label: 'يونيو' },
  { value: 'July', label: 'يوليوز' },
  { value: 'August', label: 'غشت' },
  { value: 'September', label: 'شتنبر' },
  { value: 'October', label: 'أكتوبر' },
  { value: 'November', label: 'نونبر' },
  { value: 'December', label: 'دجنبر' },
];

const MONTH_NAMES: Record<string, string> = Object.fromEntries(
  MONTHS.map((m) => [m.value, m.label])
);

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقدي' },
  { value: 'transfer', label: 'تحويل' },
  { value: 'check', label: 'شيك' },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  studentId: string;
  student: {
    fullName: string;
    phone: string | null;
    level: {
      nameAr: string;
      subject: { nameAr: string };
    } | null;
    teacher: { id: string; fullName: string } | null;
  };
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  discount: number;
  month: string;
  year: number;
  paymentDate: string | null;
  method: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

interface StudentOption {
  id: string;
  fullName: string;
  phone: string | null;
}

interface PaymentFormData {
  studentId: string;
  amount: number | '';
  paidAmount: number | '';
  discount: number | '';
  month: string;
  year: number | '';
  paymentDate: string;
  method: string;
  notes: string;
  status: string;
}

const defaultFormData: PaymentFormData = {
  studentId: '',
  amount: '',
  paidAmount: '',
  discount: '',
  month: '',
  year: new Date().getFullYear(),
  paymentDate: new Date().toISOString().split('T')[0],
  method: 'cash',
  notes: '',
  status: 'pending',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">مدفوع</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">جزئي</Badge>;
    case 'pending':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">غير مدفوع</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getMethodLabel(method: string | null) {
  switch (method) {
    case 'cash': return 'نقدي';
    case 'transfer': return 'تحويل';
    case 'check': return 'شيك';
    default: return method || '—';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'paid': return 'مدفوع';
    case 'partial': return 'جزئي';
    case 'pending': return 'غير مدفوع';
    default: return status;
  }
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ── Bon de Paiement Generator ─────────────────────────────────────────────

function generateBon(payment: Payment) {
  const student = payment.student;
  const subjectName = student.level?.subject?.nameAr || '—';
  const levelName = student.level?.nameAr || '—';
  const teacherName = student.teacher?.fullName || '—';
  const monthLabel = MONTH_NAMES[payment.month] || payment.month;
  const paymentDate = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('ar-MA')
    : '—';

  const bonNumber = payment.id.slice(-6).toUpperCase();
  const netAmount = payment.amount - payment.discount;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>بون دفع - ${bonNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
      background: #f0f0f0;
      padding: 20px;
      color: #1a1a2e;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .no-print { display: none !important; }
    }
    
    .bon-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border: 3px solid #0d9488;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    
    .bon-header {
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      color: white;
      padding: 28px 32px;
      text-align: center;
    }
    
    .bon-header h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }
    
    .bon-header p {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .bon-header .divider {
      width: 80px;
      height: 3px;
      background: #fbbf24;
      margin: 12px auto;
      border-radius: 2px;
    }
    
    .bon-address {
      background: #f0fdfa;
      padding: 12px 32px;
      text-align: center;
      border-bottom: 2px solid #0d9488;
      font-size: 13px;
      color: #334155;
    }
    
    .bon-address p {
      line-height: 1.8;
    }
    
    .bon-address .phone {
      font-weight: 700;
      direction: ltr;
      unicode-bidi: bidi-override;
    }
    
    .bon-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 32px;
      background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%);
      font-weight: 700;
      font-size: 16px;
    }
    
    .bon-title-row .receipt-title {
      font-size: 18px;
    }
    
    .bon-section {
      padding: 20px 32px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .bon-section:last-child {
      border-bottom: none;
    }
    
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #0d9488;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #fbbf24;
      display: inline-block;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    
    .info-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 14px;
    }
    
    .info-row .label {
      color: #64748b;
      font-weight: 500;
      white-space: nowrap;
      min-width: 90px;
    }
    
    .info-row .value {
      font-weight: 600;
      color: #1e293b;
    }
    
    .amounts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    
    .amounts-table th,
    .amounts-table td {
      padding: 10px 14px;
      text-align: right;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .amounts-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      font-size: 13px;
    }
    
    .amounts-table .amount-col {
      font-weight: 700;
      text-align: left;
      direction: ltr;
      unicode-bidi: bidi-override;
    }
    
    .amounts-table .paid {
      color: #059669;
    }
    
    .amounts-table .remaining {
      color: #dc2626;
    }
    
    .amounts-table .discount {
      color: #d97706;
    }
    
    .amounts-table .net {
      color: #0d9488;
      font-size: 15px;
    }
    
    .amounts-table tr:last-child td {
      border-bottom: 2px solid #0d9488;
      font-weight: 800;
      background: #f0fdfa;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 16px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 14px;
    }
    
    .status-paid { background: #dcfce7; color: #059669; }
    .status-partial { background: #fef3c7; color: #d97706; }
    .status-pending { background: #fee2e2; color: #dc2626; }
    
    .notes-section {
      min-height: 40px;
      background: #f8fafc;
      border-radius: 6px;
      padding: 12px;
      font-size: 13px;
      color: #475569;
      border: 1px dashed #cbd5e1;
    }
    
    .signatures {
      display: flex;
      justify-content: space-between;
      padding-top: 24px;
      margin-top: 16px;
    }
    
    .signature-box {
      text-align: center;
      flex: 1;
    }
    
    .signature-box .sig-label {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
      margin-bottom: 40px;
    }
    
    .signature-box .sig-line {
      width: 140px;
      height: 1px;
      background: #94a3b8;
      margin: 0 auto;
    }
    
    .bon-footer {
      text-align: center;
      padding: 12px 32px;
      background: #f8fafc;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    
    .no-print {
      text-align: center;
      margin-bottom: 16px;
    }
    
    .no-print button {
      background: #0d9488;
      color: white;
      border: none;
      padding: 10px 28px;
      border-radius: 8px;
      font-size: 15px;
      font-family: 'Tajawal', sans-serif;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .no-print button:hover {
      background: #0f766e;
    }
    
    @media print {
      .bon-container {
        box-shadow: none;
        border-width: 3px;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      طباعة البون
    </button>
  </div>
  
  <div class="bon-container">
    <!-- Header -->
    <div class="bon-header">
      <h1>AURA ACADEMY</h1>
      <div class="divider"></div>
      <p>نظام إدارة المركز التربوي</p>
    </div>
    
    <!-- Address -->
    <div class="bon-address">
      <p>بني ملال، شارع محمد الخامس</p>
      <p>فوق مكتبة وورك بيرو، الطابق الثالث</p>
      <p class="phone">الهاتف: 0606030356</p>
    </div>
    
    <!-- Title Row -->
    <div class="bon-title-row">
      <span>بون دفع / سند دفع</span>
      <span class="receipt-title">#PAY-${bonNumber}</span>
    </div>
    
    <!-- Student Info -->
    <div class="bon-section">
      <div class="section-title">معلومات الطالب</div>
      <div class="info-grid">
        <div class="info-row">
          <span class="label">اسم الطالب:</span>
          <span class="value">${student.fullName}</span>
        </div>
        <div class="info-row">
          <span class="label">الهاتف:</span>
          <span class="value" dir="ltr">${student.phone || '—'}</span>
        </div>
        <div class="info-row">
          <span class="label">المادة:</span>
          <span class="value">${subjectName} - ${levelName}</span>
        </div>
        <div class="info-row">
          <span class="label">الأستاذ:</span>
          <span class="value">${teacherName}</span>
        </div>
      </div>
    </div>
    
    <!-- Payment Details -->
    <div class="bon-section">
      <div class="section-title">تفاصيل الدفع</div>
      <table class="amounts-table">
        <thead>
          <tr>
            <th>البيان</th>
            <th class="amount-col">المبلغ (درهم)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>المبلغ المطلوب</td>
            <td class="amount-col">${payment.amount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
          </tr>
          ${payment.discount > 0 ? `
          <tr>
            <td>الخصم</td>
            <td class="amount-col discount">- ${payment.discount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td>المبلغ بعد الخصم</td>
            <td class="amount-col net">${netAmount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
          </tr>
          ` : ''}
          <tr>
            <td>المبلغ المدفوع</td>
            <td class="amount-col paid">${payment.paidAmount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td>المبلغ المتبقي</td>
            <td class="amount-col remaining">${payment.remainingAmount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td>طريقة الدفع</td>
            <td>${getMethodLabel(payment.method)}</td>
          </tr>
          <tr>
            <td>الشهر</td>
            <td>${monthLabel} ${payment.year}</td>
          </tr>
          <tr>
            <td>تاريخ الدفع</td>
            <td dir="ltr" style="text-align:right">${paymentDate}</td>
          </tr>
          <tr>
            <td>الحالة</td>
            <td><span class="status-badge status-${payment.status}">${getStatusLabel(payment.status)}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Notes -->
    <div class="bon-section">
      <div class="section-title">ملاحظات</div>
      <div class="notes-section">${payment.notes || 'لا توجد ملاحظات'}</div>
    </div>
    
    <!-- Signatures -->
    <div class="bon-section">
      <div class="signatures">
        <div class="signature-box">
          <div class="sig-label">توقيع المستلم</div>
          <div class="sig-line"></div>
        </div>
        <div class="signature-box">
          <div class="sig-label">توقيع المركز</div>
          <div class="sig-line"></div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="bon-footer">
      AURA ACADEMY &copy; ${new Date().getFullYear()} — بني ملال، شارع محمد الخامس
    </div>
  </div>
</body>
</html>`;

  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
    // Auto-trigger print after a short delay for fonts to load
    setTimeout(() => {
      newWindow.print();
    }, 500);
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function PaymentsView() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  // Filters
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterStatus, setFilterStatus] = useState('all');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState<PaymentFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterMonth !== 'all') params.set('month', filterMonth);
      if (filterYear) params.set('year', filterYear);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPayments(json);
    } catch {
      toast.error('فشل في تحميل قائمة المدفوعات');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterStatus]);

  const fetchStudents = useCallback(async (query?: string) => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      const res = await fetch(`/api/students?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      setStudents(json);
    } catch {
      console.error('Failed to fetch students');
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(studentSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch, fetchStudents]);

  // ── Form handling ──────────────────────────────────────────────────────

  const handleOpenDialog = (payment?: Payment) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        studentId: payment.studentId,
        amount: payment.amount,
        paidAmount: payment.paidAmount,
        discount: payment.discount || 0,
        month: payment.month,
        year: payment.year,
        paymentDate: payment.paymentDate?.split('T')[0] || new Date().toISOString().split('T')[0],
        method: payment.method || 'cash',
        notes: payment.notes || '',
        status: payment.status,
      });
    } else {
      setEditingPayment(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  // Computed amounts
  const discountValue = typeof formData.discount === 'number' ? formData.discount : 0;
  const netAmount = (typeof formData.amount === 'number' ? formData.amount : 0) - discountValue;
  const remainingAmount =
    typeof formData.amount === 'number' && typeof formData.paidAmount === 'number'
      ? netAmount - formData.paidAmount
      : 0;

  // Auto-detect status
  const autoStatus =
    typeof formData.amount === 'number' && typeof formData.paidAmount === 'number'
      ? formData.paidAmount >= netAmount
        ? 'paid'
        : formData.paidAmount > 0
          ? 'partial'
          : 'pending'
      : formData.status;

  const handleSubmit = async () => {
    if (!formData.studentId) {
      toast.error('يرجى اختيار التلميذ');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('يرجى إدخال المبلغ');
      return;
    }
    if (!formData.month) {
      toast.error('يرجى اختيار الشهر');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        paidAmount: Number(formData.paidAmount) || 0,
        discount: Number(formData.discount) || 0,
        year: Number(formData.year),
        remainingAmount: netAmount - (Number(formData.paidAmount) || 0),
        status: autoStatus,
      };

      const url = editingPayment ? `/api/payments/${editingPayment.id}` : '/api/payments';
      const method = editingPayment ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(editingPayment ? 'تم تحديث القسط بنجاح' : 'تم إضافة القسط بنجاح');

      // After saving, offer to print bon
      if (!editingPayment && res.ok) {
        const savedPayment = await res.json();
        setDialogOpen(false);
        fetchPayments();
        // Offer to print bon
        setTimeout(() => {
          if (confirm('هل تريد طباعة بون الدفع؟')) {
            generateBon(savedPayment);
          }
        }, 300);
        return;
      }

      setDialogOpen(false);
      fetchPayments();
    } catch {
      toast.error('فشل في حفظ البيانات');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPayment) return;
    try {
      const res = await fetch(`/api/payments/${deletingPayment.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('تم حذف القسط بنجاح');
      setDeleteOpen(false);
      setDeletingPayment(null);
      fetchPayments();
    } catch {
      toast.error('فشل في حذف القسط');
    }
  };

  // ── Totals ─────────────────────────────────────────────────────────────

  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);
  const totalDiscount = payments.reduce((s, p) => s + (p.discount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + p.paidAmount, 0);
  const totalRemaining = payments.reduce((s, p) => s + p.remainingAmount, 0);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="h-5 w-5" />
          <span className="text-sm">{payments.length} قسط</span>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة قسط
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">المطلوب</p>
            <p className="text-lg font-bold mt-1">
              {totalAmount.toLocaleString()} <span className="text-xs font-normal">درهم</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">الخصم</p>
            <p className="text-lg font-bold text-amber-600 mt-1">
              {totalDiscount.toLocaleString()} <span className="text-xs font-normal">درهم</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">المدفوع</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">
              {totalPaid.toLocaleString()} <span className="text-xs font-normal">درهم</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">المتبقي</p>
            <p className="text-lg font-bold text-red-600 mt-1">
              {totalRemaining.toLocaleString()} <span className="text-xs font-normal">درهم</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="كل الأشهر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأشهر</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="السنة"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                dir="ltr"
                className="w-full"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
                  <SelectItem value="partial">جزئي</SelectItem>
                  <SelectItem value="pending">غير مدفوع</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">لا توجد مدفوعات</p>
              <p className="text-sm mt-1">اضغط على &quot;إضافة قسط&quot; لإضافة قسط جديد</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التلميذ</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الخصم</TableHead>
                    <TableHead className="text-right hidden md:table-cell">المدفوع</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">المتبقي</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">الشهر</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-medium text-sm">{payment.student.fullName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {payment.student.level && (
                              <span>{payment.student.level.subject.nameAr} - {payment.student.level.nameAr}</span>
                            )}
                            {payment.student.teacher && (
                              <span className="text-teal-600">• {payment.student.teacher.fullName}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {payment.amount.toLocaleString()} <span className="text-xs font-normal">درهم</span>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell text-amber-600">
                        {payment.discount > 0 ? (
                          <span>{payment.discount.toLocaleString()} <span className="text-xs font-normal">درهم</span></span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell text-emerald-600">
                        {payment.paidAmount.toLocaleString()} <span className="text-xs font-normal">درهم</span>
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-red-600">
                        {payment.remainingAmount.toLocaleString()} <span className="text-xs font-normal">درهم</span>
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        {MONTH_NAMES[payment.month] || payment.month} {payment.year}
                      </TableCell>
                      <TableCell className="text-right">
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => generateBon(payment)}
                            title="طباعة بون الدفع"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(payment)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingPayment(payment);
                              setDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          ADD / EDIT DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? 'تعديل القسط' : 'إضافة قسط جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingPayment ? 'قم بتعديل بيانات القسط أدناه' : 'أدخل بيانات القسط الجديد'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Student Selection */}
            <div className="space-y-1.5">
              <Label>التلميذ *</Label>
              <Select
                value={formData.studentId}
                onValueChange={(val) => setFormData({ ...formData, studentId: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر التلميذ" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="بحث عن تلميذ..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="pl-3 pr-8 h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span>{s.fullName}</span>
                          {s.phone && (
                            <span className="text-xs text-muted-foreground" dir="ltr">{s.phone}</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                    {students.length === 0 && (
                      <div className="px-4 py-2 text-sm text-muted-foreground text-center">
                        لا توجد نتائج
                      </div>
                    )}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Amounts */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                تفاصيل المبلغ
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">المبلغ (درهم) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) || '' })}
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount">الخصم (درهم)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: Number(e.target.value) || 0 })}
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="paidAmount">المدفوع (درهم)</Label>
                  <Input
                    id="paidAmount"
                    type="number"
                    min="0"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: Number(e.target.value) || '' })}
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>المتبقي</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm">
                    <span dir="ltr">{Math.max(0, remainingAmount).toLocaleString()}</span>
                    <span className="mr-1 text-muted-foreground text-xs">درهم</span>
                  </div>
                </div>
              </div>
              {discountValue > 0 && (
                <div className="text-xs text-amber-600 bg-amber-50 rounded-md p-2">
                  المبلغ بعد الخصم: <strong>{netAmount.toLocaleString()} درهم</strong>
                </div>
              )}
            </div>

            {/* Month / Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الشهر *</Label>
                <Select
                  value={formData.month}
                  onValueChange={(val) => setFormData({ ...formData, month: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الشهر" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">السنة</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) || '' })}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Method & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>طريقة الدفع</Label>
                <Select
                  value={formData.method}
                  onValueChange={(val) => setFormData({ ...formData, method: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentDate">تاريخ الدفع</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>

            {/* Auto-detected status */}
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <div className="flex items-center gap-2">
                {getStatusBadge(autoStatus)}
                <span className="text-xs text-muted-foreground">(تلقائية حسب المبلغ)</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {editingPayment && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => generateBon(editingPayment)}
              >
                <FileText className="h-4 w-4" />
                طباعة البون
              </Button>
            )}
            <div className="flex gap-2 mr-auto">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'جاري الحفظ...' : editingPayment ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا القسط؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
