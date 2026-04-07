'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Receipt,
  Wallet,
  Filter,
  FileText,
  AlertTriangle,
  User,
  Phone,
  UserCheck,
  CalendarDays,
  X,
  ChevronDown,
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
    id: string;
    fullName: string;
    phone: string | null;
    parentName: string | null;
    parentPhone: string | null;
    monthlyFee: number;
    level: {
      nameAr: string;
      subject: { nameAr: string; service?: { nameAr: string } | null } | null;
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

interface StudentSearchResult {
  id: string;
  fullName: string;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  monthlyFee: number;
  level: {
    nameAr: string;
    subject: { nameAr: string; service?: { nameAr: string } | null } | null;
  } | null;
  teacher: { id: string; fullName: string } | null;
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

interface OverdueService {
  service: string;
  totalOverdue: number;
  studentCount: number;
  levels: OverdueLevel[];
}

interface OverdueLevel {
  level: string;
  totalOverdue: number;
  studentCount: number;
  students: OverdueStudent[];
}

interface OverdueStudent {
  studentId: string;
  studentName: string;
  phone: string | null;
  parentPhone: string | null;
  parentName: string | null;
  monthlyFee: number;
  totalOverdue: number;
  monthsOverdue: number;
  paymentCount: number;
  overduePayments: {
    id: string;
    month: string;
    monthLabel: string;
    year: number;
    remainingAmount: number;
    monthsOverdue: number;
  }[];
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
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
          مدفوع
        </Badge>
      );
    case 'partial':
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
          جزئي
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
          غير مدفوع
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getMethodLabel(method: string | null) {
  switch (method) {
    case 'cash':
      return 'نقدي';
    case 'transfer':
      return 'تحويل';
    case 'check':
      return 'شيك';
    default:
      return method || '—';
  }
}

function formatDate(dayMonthYear: string): string {
  if (!dayMonthYear) return '—';
  const d = new Date(dayMonthYear);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day} / ${month} / ${year}`;
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

// ── Bon (Receipt) Generator ────────────────────────────────────────────────

function generateBon(payment: Payment) {
  const student = payment.student;
  const monthLabel = MONTH_NAMES[payment.month] || payment.month;
  const paymentDate = payment.paymentDate ? formatDate(payment.paymentDate) : '—';
  const netAmount = payment.amount - payment.discount;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>بون دفع</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
      background: white;
      padding: 0;
      color: #1a1a2e;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      .no-print { display: none !important; }
      @page { margin: 10mm; size: A4; }
    }
    .bon {
      max-width: 700px;
      margin: 0 auto;
      border: 2px solid #0d9488;
      padding: 32px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 800;
      color: #0d9488;
      margin-bottom: 8px;
    }
    .header .address {
      font-size: 12px;
      color: #475569;
      line-height: 1.8;
    }
    .header .phone-line {
      font-weight: 600;
      direction: ltr;
      display: inline-block;
    }
    .divider {
      height: 2px;
      background: #0d9488;
      margin: 16px 0;
    }
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .info-item {
      font-size: 14px;
    }
    .info-item .label {
      color: #64748b;
      font-weight: 500;
    }
    .info-item .value {
      font-weight: 700;
      color: #1e293b;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .details-table th,
    .details-table td {
      padding: 8px 12px;
      text-align: right;
      border-bottom: 1px solid #e2e8f0;
    }
    .details-table th {
      background: #f0fdfa;
      font-weight: 600;
      color: #0d9488;
      font-size: 13px;
    }
    .details-table .amount {
      font-weight: 700;
      text-align: left;
      direction: ltr;
    }
    .details-table .green { color: #059669; }
    .details-table .red { color: #dc2626; }
    .details-table .amber { color: #d97706; }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 60px;
      padding-top: 20px;
    }
    .sig-box {
      text-align: center;
      flex: 1;
    }
    .sig-box .sig-label {
      font-size: 13px;
      color: #475569;
      font-weight: 600;
      margin-bottom: 40px;
    }
    .sig-box .sig-line {
      width: 160px;
      height: 1px;
      background: #334155;
      margin: 0 auto;
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
    }
    .no-print button:hover { background: #0f766e; }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">طباعة البون</button>
  </div>
  <div class="bon">
    <div class="header">
      <h1>نظام إدارة المركز التربوي</h1>
      <div class="address">
        <div class="phone-line">الهاتف: 0606030356</div>
        <div>Bd med V, N°407 Route de Marrakech, Béni Mellal</div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="info-section">
      <div class="info-item">
        <span class="label">اسم التلميذ: </span>
        <span class="value">${student.fullName}</span>
      </div>
      <div class="info-item">
        <span class="label">الهاتف: </span>
        <span class="value" dir="ltr">${student.phone || '—'}</span>
      </div>
    </div>
    <table class="details-table">
      <thead>
        <tr>
          <th>البيان</th>
          <th class="amount">المبلغ (درهم)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>المبلغ المطلوب</td>
          <td class="amount">${payment.amount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>
        ${payment.discount > 0 ? `<tr>
          <td>الخصم</td>
          <td class="amount amber">- ${payment.discount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td>المبلغ بعد الخصم</td>
          <td class="amount">${netAmount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>` : ''}
        <tr>
          <td>المدفوع</td>
          <td class="amount green">${payment.paidAmount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td>المتبقي</td>
          <td class="amount red">${payment.remainingAmount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td>الشهر / السنة</td>
          <td>${monthLabel} ${payment.year}</td>
        </tr>
        <tr>
          <td>تاريخ الدفع</td>
          <td dir="ltr" style="text-align:right">${paymentDate}</td>
        </tr>
      </tbody>
    </table>
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">توقيع ولي الأمر</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-box">
        <div class="sig-label">توقيع المركز</div>
        <div class="sig-line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
    setTimeout(() => {
      newWindow.print();
    }, 500);
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function PaymentsView() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Student search state
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<StudentSearchResult[]>([]);
  const [studentSearching, setStudentSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [yearlyPaid, setYearlyPaid] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Overdue dialog state
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [overdueData, setOverdueData] = useState<OverdueService[]>([]);
  const [overdueLoading, setOverdueLoading] = useState(false);

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

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // ── Student search ────────────────────────────────────────────────────

  const handleStudentSearch = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setStudentSearchResults([]);
      setStudentSearching(false);
      return;
    }
    setStudentSearching(true);
    try {
      const params = new URLSearchParams({ search: query });
      const res = await fetch(`/api/students?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setStudentSearchResults(json);
    } catch {
      setStudentSearchResults([]);
    } finally {
      setStudentSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      handleStudentSearch(studentSearchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [studentSearchQuery, handleStudentSearch]);

  // Fetch yearly paid amount when student is selected
  useEffect(() => {
    if (!selectedStudent) {
      setYearlyPaid(0);
      return;
    }
    const currentYear = new Date().getFullYear();
    (async () => {
      try {
        const res = await fetch(
          `/api/payments?studentId=${selectedStudent.id}&year=${currentYear}`
        );
        if (!res.ok) return;
        const yearPayments: Payment[] = await res.json();
        const total = yearPayments.reduce((s, p) => s + p.paidAmount, 0);
        setYearlyPaid(total);
      } catch {
        setYearlyPaid(0);
      }
    })();
  }, [selectedStudent]);

  // ── Overdue fetching ──────────────────────────────────────────────────

  const fetchOverdue = useCallback(async () => {
    setOverdueLoading(true);
    try {
      const res = await fetch('/api/payments/overdue');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setOverdueData(json);
    } catch {
      toast.error('فشل في تحميل المدفوعات المستحقة');
    } finally {
      setOverdueLoading(false);
    }
  }, []);

  const handleOpenOverdue = () => {
    setOverdueOpen(true);
    fetchOverdue();
  };

  // ── Form handling ──────────────────────────────────────────────────────

  const handleOpenDialog = (payment?: Payment) => {
    if (payment) {
      setEditingPayment(payment);
      setSelectedStudent({
        id: payment.student.id,
        fullName: payment.student.fullName,
        phone: payment.student.phone,
        parentName: payment.student.parentName,
        parentPhone: payment.student.parentPhone,
        monthlyFee: payment.student.monthlyFee,
        level: payment.student.level,
        teacher: payment.student.teacher,
      });
      setFormData({
        studentId: payment.studentId,
        amount: payment.amount,
        paidAmount: payment.paidAmount,
        discount: payment.discount || 0,
        month: payment.month,
        year: payment.year,
        paymentDate:
          payment.paymentDate?.split('T')[0] ||
          new Date().toISOString().split('T')[0],
        method: payment.method || 'cash',
        notes: payment.notes || '',
        status: payment.status,
      });
    } else {
      setEditingPayment(null);
      setSelectedStudent(null);
      setStudentSearchQuery('');
      setStudentSearchResults([]);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleSelectStudent = (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setStudentSearchQuery('');
    setStudentSearchResults([]);
    setFormData((prev) => ({
      ...prev,
      studentId: student.id,
      amount: student.monthlyFee || '',
    }));
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setFormData((prev) => ({ ...prev, studentId: '', amount: '' }));
  };

  // Computed amounts
  const discountValue =
    typeof formData.discount === 'number' ? formData.discount : 0;
  const netAmount =
    (typeof formData.amount === 'number' ? formData.amount : 0) - discountValue;
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
        remainingAmount:
          netAmount - (Number(formData.paidAmount) || 0),
        status: autoStatus,
      };

      const url = editingPayment
        ? `/api/payments/${editingPayment.id}`
        : '/api/payments';
      const method = editingPayment ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(
        editingPayment ? 'تم تحديث القسط بنجاح' : 'تم إضافة القسط بنجاح'
      );

      // Offer to print bon for new payments
      if (!editingPayment) {
        const savedPayment = await res.json();
        setDialogOpen(false);
        fetchPayments();
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
      const res = await fetch(`/api/payments/${deletingPayment.id}`, {
        method: 'DELETE',
      });
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
  const totalRemaining = payments.reduce(
    (s, p) => s + p.remainingAmount,
    0
  );

  const grandTotalOverdue = overdueData.reduce(
    (s, svc) => s + svc.totalOverdue,
    0
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="h-5 w-5" />
          <span className="text-sm">{payments.length} قسط</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleOpenOverdue}
            className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          >
            <AlertTriangle className="h-4 w-4" />
            المدفوعات المستحقة
          </Button>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة قسط
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">المطلوب</p>
            <p className="text-lg font-bold mt-1">
              {totalAmount.toLocaleString()}{' '}
              <span className="text-xs font-normal">درهم</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">الخصم</p>
            <p className="text-lg font-bold text-amber-600 mt-1">
              {totalDiscount.toLocaleString()}{' '}
              <span className="text-xs font-normal">درهم</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">المدفوع</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">
              {totalPaid.toLocaleString()}{' '}
              <span className="text-xs font-normal">درهم</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">المتبقي</p>
            <p className="text-lg font-bold text-red-600 mt-1">
              {totalRemaining.toLocaleString()}{' '}
              <span className="text-xs font-normal">درهم</span>
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
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
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
              <p className="text-sm mt-1">
                اضغط على &quot;إضافة قسط&quot; لإضافة قسط جديد
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التلميذ</TableHead>
                    <TableHead className="text-right">الشهر/السنة</TableHead>
                    <TableHead className="text-right hidden md:table-cell">
                      المبلغ
                    </TableHead>
                    <TableHead className="text-right hidden md:table-cell">
                      المدفوع
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">
                      المتبقي
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">
                      الخصم
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">
                      التاريخ
                    </TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-medium text-sm">
                            {payment.student.fullName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {payment.student.level && (
                              <span>
                                {payment.student.level.subject.nameAr} -{' '}
                                {payment.student.level.nameAr}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {MONTH_NAMES[payment.month] || payment.month}{' '}
                        {payment.year}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell font-medium">
                        {payment.amount.toLocaleString()}{' '}
                        <span className="text-xs font-normal">درهم</span>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell text-emerald-600">
                        {payment.paidAmount.toLocaleString()}{' '}
                        <span className="text-xs font-normal">درهم</span>
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-red-600">
                        {payment.remainingAmount.toLocaleString()}{' '}
                        <span className="text-xs font-normal">درهم</span>
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-amber-600">
                        {payment.discount > 0 ? (
                          <span>
                            {payment.discount.toLocaleString()}{' '}
                            <span className="text-xs font-normal">درهم</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-sm text-muted-foreground">
                        {payment.paymentDate
                          ? formatDate(payment.paymentDate)
                          : '—'}
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
                            title="طباعة بون"
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
          ADD / EDIT PAYMENT DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingPayment ? 'تعديل القسط' : 'إضافة قسط جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingPayment
                ? 'قم بتعديل بيانات القسط أدناه'
                : 'ابحث عن التلميذ ثم أدخل بيانات القسط'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="grid gap-4 pb-6 pt-2">
              {/* ── Student Search ─────────────────────────────────────── */}
              {!editingPayment && !selectedStudent && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">
                    البحث عن التلميذ
                  </Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="اكتب اسم أو رقم هاتف التلميذ..."
                      value={studentSearchQuery}
                      onChange={(e) =>
                        setStudentSearchQuery(e.target.value)
                      }
                      className="pr-10"
                    />
                  </div>

                  {/* Search results as profile cards */}
                  {studentSearching && (
                    <div className="flex items-center justify-center py-4">
                      <Skeleton className="h-12 w-full" />
                    </div>
                  )}

                  {!studentSearching &&
                    studentSearchResults.length > 0 &&
                    !selectedStudent && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                        {studentSearchResults.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSelectStudent(s)}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/40 transition-colors text-right w-full"
                          >
                            <div className="h-9 w-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">
                                {s.fullName}
                              </p>
                              {s.phone && (
                                <p
                                  className="text-xs text-muted-foreground truncate"
                                  dir="ltr"
                                >
                                  {s.phone}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {s.level && (
                                  <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">
                                    {s.level.subject.nameAr} -{' '}
                                    {s.level.nameAr}
                                  </span>
                                )}
                                {s.monthlyFee > 0 && (
                                  <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                                    {s.monthlyFee.toLocaleString()} درهم/شهر
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                  {!studentSearching &&
                    studentSearchQuery.length >= 1 &&
                    studentSearchResults.length === 0 &&
                    !selectedStudent && (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        لم يتم العثور على تلاميذ
                      </div>
                    )}
                </div>
              )}

              {/* ── Selected Student Profile Card ──────────────────────── */}
              {selectedStudent && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      التلميذ المختار
                    </Label>
                    {!editingPayment && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearStudent}
                        className="h-7 text-xs text-muted-foreground"
                      >
                        <X className="h-3 w-3 ml-1" />
                        تغيير
                      </Button>
                    )}
                  </div>

                  <div className="rounded-lg border bg-gradient-to-br from-teal-50/50 to-white p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            الاسم:{' '}
                          </span>
                          <span className="font-bold">
                            {selectedStudent.fullName}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            الهاتف:{' '}
                          </span>
                          <span className="font-medium" dir="ltr">
                            {selectedStudent.phone || '—'}
                          </span>
                        </div>
                        {selectedStudent.parentName && (
                          <div>
                            <span className="text-muted-foreground">
                              ولي الأمر:{' '}
                            </span>
                            <span className="font-medium">
                              {selectedStudent.parentName}
                            </span>
                          </div>
                        )}
                        {selectedStudent.parentPhone && (
                          <div>
                            <span className="text-muted-foreground">
                              هاتف ولي الأمر:{' '}
                            </span>
                            <span
                              className="font-medium"
                              dir="ltr"
                            >
                              {selectedStudent.parentPhone}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">
                            القسط الشهري:{' '}
                          </span>
                          <span className="font-bold text-teal-700">
                            {selectedStudent.monthlyFee.toLocaleString()}{' '}
                            درهم
                          </span>
                        </div>
                        {selectedStudent.level && (
                          <div>
                            <span className="text-muted-foreground">
                              المستوى:{' '}
                            </span>
                            <span className="font-medium">
                              {selectedStudent.level.subject.nameAr} -{' '}
                              {selectedStudent.level.nameAr}
                            </span>
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <span className="text-muted-foreground">
                            المدفوع هذا العام ({new Date().getFullYear()}):{' '}
                          </span>
                          <span className="font-bold text-emerald-600">
                            {yearlyPaid.toLocaleString()} درهم
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* ── Payment Details ────────────────────────────────────── */}
              <div className="space-y-3">
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
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amount: Number(e.target.value) || '',
                        })
                      }
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
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discount: Number(e.target.value) || 0,
                        })
                      }
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
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          paidAmount: Number(e.target.value) || '',
                        })
                      }
                      placeholder="0"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>المتبقي</Label>
                    <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm">
                      <span dir="ltr">
                        {Math.max(0, remainingAmount).toLocaleString()}
                      </span>
                      <span className="mr-1 text-muted-foreground text-xs">
                        درهم
                      </span>
                    </div>
                  </div>
                </div>
                {discountValue > 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 rounded-md p-2">
                    المبلغ بعد الخصم:{' '}
                    <strong>{netAmount.toLocaleString()} درهم</strong>
                  </div>
                )}
              </div>

              {/* ── Month / Year / Method ──────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>الشهر *</Label>
                  <Select
                    value={formData.month}
                    onValueChange={(val) =>
                      setFormData({ ...formData, month: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر الشهر" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>السنة *</Label>
                  <Input
                    type="number"
                    min="2020"
                    max="2040"
                    value={formData.year}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        year: Number(e.target.value) || '',
                      })
                    }
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>طريقة الدفع</Label>
                  <Select
                    value={formData.method}
                    onValueChange={(val) =>
                      setFormData({ ...formData, method: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Notes ──────────────────────────────────────────────── */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="ملاحظات إضافية (اختياري)"
                  rows={2}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 pb-6 pt-2 border-t bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-muted-foreground">
                الحالة:{' '}
                {autoStatus === 'paid'
                  ? 'مدفوع'
                  : autoStatus === 'partial'
                    ? 'جزئي'
                    : 'غير مدفوع'}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="gap-2"
                >
                  {submitting ? (
                    <span className="animate-spin">⏳</span>
                  ) : null}
                  {editingPayment ? 'تحديث' : 'حفظ القسط'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          OVERDUE PAYMENTS DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={overdueOpen} onOpenChange={setOverdueOpen}>
        <DialogContent className="sm:max-w-3xl flex flex-col p-0 gap-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              المدفوعات المستحقة
            </DialogTitle>
            <DialogDescription>
              قائمة التلاميذ الذين لديهم أقساط متأخرة عن الدفع
            </DialogDescription>
          </DialogHeader>

          {overdueLoading ? (
            <div className="px-6 py-8">
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
          ) : overdueData.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-emerald-400 opacity-50" />
              <p className="font-medium">لا توجد مدفوعات مستحقة</p>
              <p className="text-sm mt-1">جميع الأقسط مسددة في وقتها</p>
            </div>
          ) : (
            <>
              {/* Grand total bar */}
              <div className="mx-6 mt-2 mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-800">
                  إجمالي المستحقات
                </span>
                <span className="text-lg font-bold text-amber-700">
                  {grandTotalOverdue.toLocaleString()}{' '}
                  <span className="text-sm font-normal">درهم</span>
                </span>
              </div>

              <ScrollArea className="flex-1 px-6 pb-6 max-h-[65vh]">
                <div className="space-y-6">
                  {overdueData.map((service) => (
                    <div key={service.service}>
                      {/* Service header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-1 w-4 rounded bg-amber-400" />
                        <h3 className="font-bold text-base">
                          {service.service}
                        </h3>
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-300 text-amber-700"
                        >
                          {service.studentCount} تلميذ —{' '}
                          {service.totalOverdue.toLocaleString()} درهم
                        </Badge>
                      </div>

                      {/* Levels */}
                      {service.levels.map((level) => (
                        <div
                          key={level.level}
                          className="mb-4 mr-4"
                        >
                          <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                            {level.level}
                          </h4>
                          <div className="space-y-2">
                            {level.students.map((student) => (
                              <div
                                key={student.studentId}
                                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors"
                              >
                                <div className="h-9 w-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                  <AlertTriangle className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 text-sm">
                                  <div>
                                    <span className="font-semibold">
                                      {student.studentName}
                                    </span>
                                    {student.parentName && (
                                      <span className="text-xs text-muted-foreground block">
                                        ولي الأمر: {student.parentName}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                    {student.phone && (
                                      <span
                                        className="flex items-center gap-1"
                                        dir="ltr"
                                      >
                                        <Phone className="h-3 w-3" />
                                        {student.phone}
                                      </span>
                                    )}
                                    {student.parentPhone && (
                                      <span
                                        className="flex items-center gap-1"
                                        dir="ltr"
                                      >
                                        <UserCheck className="h-3 w-3" />
                                        {student.parentPhone}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-red-600">
                                      {student.totalOverdue.toLocaleString()}{' '}
                                      درهم
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-red-200 text-red-600"
                                    >
                                      {student.paymentCount} شهر متأخر
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION
          ═══════════════════════════════════════════════════════════════════ */}
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
