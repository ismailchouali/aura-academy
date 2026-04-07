'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
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
  Pencil,
  Trash2,
  Wallet,
  Filter,
  CircleDollarSign,
  Clock,
  Receipt,
  Printer,
  FileText,
  Users,
  TrendingUp,
  Calculator,
  School,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface Teacher {
  id: string;
  fullName: string;
  phone?: string;
  percentage?: number;
  subjects: {
    id: string;
    subjectId: string;
    subject: {
      id: string;
      name: string;
      nameAr: string;
    };
  }[];
}

interface TeacherPayment {
  id: string;
  teacherId: string;
  teacher: {
    fullName: string;
    phone?: string;
    percentage?: number;
    subjects?: {
      subject: {
        nameAr: string;
        name: string;
      };
    }[];
  };
  amount: number;
  month: string;
  year: number;
  paymentDate: string;
  notes: string;
  status: string;
}

interface CalculationData {
  teacherId: string;
  teacherName: string;
  teacherPhone?: string;
  teacherPercentage: number;
  totalStudents: number;
  totalCollected: number;
  teacherShare: number;
  groups: {
    groupName: string;
    subjectNameAr: string;
    levelNameAr: string;
    studentCount: number;
  }[];
}

interface PaymentFormData {
  teacherId: string;
  amount: string;
  month: string;
  year: string;
  paymentDate: string;
  notes: string;
  status: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const monthNames = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
];

const emptyForm: PaymentFormData = {
  teacherId: '',
  amount: '',
  month: String(new Date().getMonth() + 1),
  year: new Date().getFullYear().toString(),
  paymentDate: new Date().toISOString().split('T')[0],
  notes: '',
  status: 'paid',
};

// ─── Helpers ─────────────────────────────────────────────────────────

function getMonthName(month: string) {
  const idx = parseInt(month) - 1;
  return idx >= 0 && idx < 12 ? monthNames[idx] : month;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">مدفوع</Badge>;
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">معلق</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Bon (Receipt) Printer ───────────────────────────────────────────

function printTeacherBon(
  payment: TeacherPayment,
  teacher: Teacher | undefined,
  calcData: CalculationData | undefined
) {
  const teacherName = payment.teacher?.fullName || teacher?.fullName || '—';
  const teacherPhone = payment.teacher?.phone || teacher?.phone || '—';
  const subjects = teacher?.subjects
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
  const yearStr = payment.year;

  // Build groups table rows
  const groups = calcData?.groups || [];
  const totalStudents = calcData?.totalStudents || groups.reduce((s, g) => s + g.studentCount, 0);

  let groupsTableHTML = '';
  if (groups.length > 0) {
    groupsTableHTML = `
      <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:12px;">
        <thead>
          <tr style="background:#f0fdfa;">
            <th style="border:1px solid #d1d5db; padding:6px 10px; text-align:right; font-weight:600;">#</th>
            <th style="border:1px solid #d1d5db; padding:6px 10px; text-align:right; font-weight:600;">المادة / المستوى</th>
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

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>بون دفع أستاذ - ${teacherName}</title>
<style>
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
    background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
    color: white;
    text-align: center;
    padding: 14px 20px;
  }
  .bon-header h1 {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .bon-sub {
    display: flex;
    justify-content: center;
    gap: 24px;
    font-size: 11px;
    opacity: 0.9;
    flex-wrap: wrap;
  }
  .bon-sub span { direction: ltr; }
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
    padding: 20px 20px 14px;
    display: flex;
    justify-content: space-between;
    gap: 20px;
  }
  .signature-box {
    flex: 1;
    text-align: center;
  }
  .signature-label {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 28px;
  }
  .signature-line {
    border-bottom: 1px solid #94a3b8;
    width: 140px;
    margin: 0 auto;
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
      <h1>نظام إدارة المركز التربوي</h1>
      <div class="bon-sub">
        <span>الهاتف: 0606030356</span>
        <span>Bd med V, N°407 Route de Marrakech, Béni Mellal</span>
      </div>
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
      <div class="signature-box">
        <div class="signature-label">توقيع المركز</div>
        <div class="signature-line"></div>
      </div>
      <div class="signature-box">
        <div class="signature-label">توقيع الأستاذ</div>
        <div class="signature-line"></div>
      </div>
    </div>
  </div>

  <div class="no-print" style="text-align:center; margin-top:12px;">
    <button onclick="window.print()" style="padding:8px 24px; background:#0d9488; color:white; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-size:14px;">طباعة</button>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    }
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=750,height=900');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    toast.error('يرجى السماح بالنوافذ المنبثقة لطباعة البون');
  }
}

// ─── Main Component ──────────────────────────────────────────────────

export function TeacherPaymentsView() {
  const [payments, setPayments] = useState<TeacherPayment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [calcData, setCalcData] = useState<CalculationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [calcLoading, setCalcLoading] = useState(false);

  // Filters
  const [filterTeacherId, setFilterTeacherId] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<TeacherPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<TeacherPayment | null>(null);

  // Form
  const [form, setForm] = useState<PaymentFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // ─── Data Fetching ─────────────────────────────────────────────────

  const fetchPayments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterTeacherId && filterTeacherId !== 'all') params.set('teacherId', filterTeacherId);
      if (filterMonth && filterMonth !== 'all') params.set('month', filterMonth);
      if (filterYear && filterYear !== 'all') params.set('year', filterYear);
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);

      const query = params.toString();
      const res = await fetch(`/api/teacher-payments${query ? `?${query}` : ''}`);
      if (!res.ok) throw new Error('فشل في تحميل البيانات');
      const data = await res.json();
      setPayments(data);
    } catch {
      toast.error('فشل في تحميل المدفوعات');
    } finally {
      setLoading(false);
    }
  }, [filterTeacherId, filterMonth, filterYear, filterStatus]);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error('فشل في تحميل البيانات');
      const data = await res.json();
      setTeachers(data);
    } catch {
      toast.error('فشل في تحميل قائمة الأساتذة');
    }
  }, []);

  const fetchCalcData = useCallback(async (teacherId?: string) => {
    setCalcLoading(true);
    try {
      const params = new URLSearchParams({ calculate: 'true' });
      if (teacherId) params.set('teacherId', teacherId);
      const res = await fetch(`/api/teacher-payments?${params.toString()}`);
      if (!res.ok) throw new Error('فشل');
      const data = await res.json();
      setCalcData(data);
    } catch {
      toast.error('فشل في تحميل بيانات الحساب');
    } finally {
      setCalcLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  // ─── Computed Values ──────────────────────────────────────────────

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1);
  const currentYear = String(now.getFullYear());

  const totalThisMonth = useMemo(
    () =>
      payments
        .filter((p) => p.month === currentMonth && String(p.year) === currentYear)
        .reduce((s, p) => s + (p.amount || 0), 0),
    [payments, currentMonth, currentYear]
  );

  const totalThisYear = useMemo(
    () =>
      payments
        .filter((p) => String(p.year) === currentYear)
        .reduce((s, p) => s + (p.amount || 0), 0),
    [payments, currentYear]
  );

  const uniqueTeachersPaid = useMemo(() => {
    const ids = new Set(payments.filter((p) => p.status === 'paid').map((p) => p.teacherId));
    return ids.size;
  }, [payments]);

  // Selected teacher calculation
  const selectedCalc = useMemo(() => {
    if (!form.teacherId) return null;
    return calcData.find((c) => c.teacherId === form.teacherId) || null;
  }, [form.teacherId, calcData]);

  // Years for filter
  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  // ─── Form Handlers ────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingPayment(null);
    setForm({
      ...emptyForm,
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
      paymentDate: now.toISOString().split('T')[0],
    });
    fetchCalcData();
    setFormOpen(true);
  };

  const openEditDialog = (payment: TeacherPayment) => {
    setEditingPayment(payment);
    setForm({
      teacherId: payment.teacherId,
      amount: payment.amount ? String(payment.amount) : '',
      month: payment.month || '',
      year: payment.year ? String(payment.year) : '',
      paymentDate: payment.paymentDate ? payment.paymentDate.split('T')[0] : '',
      notes: payment.notes || '',
      status: payment.status,
    });
    // Fetch calc for the teacher to show in bon
    fetchCalcData(payment.teacherId);
    setFormOpen(true);
  };

  const handleTeacherSelect = (teacherId: string) => {
    setForm((prev) => ({
      ...prev,
      teacherId,
      amount: '', // clear amount so user sees auto-calculated value
    }));
  };

  const handleApplyCalculation = () => {
    if (selectedCalc) {
      setForm((prev) => ({
        ...prev,
        amount: String(Math.round(selectedCalc.teacherShare * 100) / 100),
      }));
      toast.success('تم تطبيق الحساب التلقائي');
    }
  };

  const handleSubmit = async () => {
    if (!form.teacherId) {
      toast.error('يرجى اختيار الأستاذ');
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('يرجى إدخال المبلغ');
      return;
    }
    if (!form.month) {
      toast.error('يرجى اختيار الشهر');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        teacherId: form.teacherId,
        amount: parseFloat(form.amount),
        month: form.month,
        year: parseInt(form.year) || now.getFullYear(),
        paymentDate: form.paymentDate ? new Date(form.paymentDate).toISOString() : null,
        notes: form.notes,
        status: form.status,
      };

      const url = editingPayment
        ? `/api/teacher-payments/${editingPayment.id}`
        : '/api/teacher-payments';
      const method = editingPayment ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('فشل في حفظ البيانات');

      toast.success(editingPayment ? 'تم تحديث الدفعة بنجاح' : 'تم إضافة الدفعة بنجاح');
      setFormOpen(false);
      fetchPayments();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPayment) return;
    try {
      const res = await fetch(`/api/teacher-payments/${deletingPayment.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('فشل في الحذف');
      toast.success('تم حذف الدفعة بنجاح');
      setDeleteOpen(false);
      setDeletingPayment(null);
      fetchPayments();
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handlePrintBon = (payment: TeacherPayment) => {
    const teacher = teachers.find((t) => t.id === payment.teacherId);
    // Find calc data for this teacher
    const teacherCalc = calcData.find((c) => c.teacherId === payment.teacherId);

    printTeacherBon(payment, teacher, teacherCalc);
  };

  const getTeacherName = (teacherId: string) =>
    teachers.find((t) => t.id === teacherId)?.fullName || teacherId;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">مداخيل الأساتذة</h2>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة ومتابعة مدفوعات الأساتذة مع الحساب التلقائي
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة دفعة
        </Button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي مدفوعات هذا الشهر</p>
                <p className="text-xl font-bold text-teal-600">
                  {totalThisMonth.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-muted-foreground">درهم</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <CircleDollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي مدفوعات هذه السنة</p>
                <p className="text-xl font-bold text-amber-600">
                  {totalThisYear.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-muted-foreground">درهم</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">عدد الأساتذة المدفوع لهم</p>
                <p className="text-xl font-bold text-sky-600">{uniqueTeachersPaid}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">تصفية</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={filterTeacherId} onValueChange={setFilterTeacherId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="جميع الأساتذة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأساتذة</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="جميع الأشهر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأشهر</SelectItem>
                {monthNames.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="جميع السنوات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع السنوات</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="جميع الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="paid">مدفوع</SelectItem>
                <SelectItem value="pending">معلق</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wallet className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">لا توجد مدفوعات</p>
              <p className="text-sm text-muted-foreground mt-1">
                {filterTeacherId !== 'all' || filterMonth !== 'all' || filterYear !== 'all' || filterStatus !== 'all'
                  ? 'لا توجد نتائج مطابقة لمعايير التصفية'
                  : 'ابدأ بإضافة دفعة جديدة'}
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الأستاذ</TableHead>
                    <TableHead className="text-right">المبلغ (درهم)</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الشهر</TableHead>
                    <TableHead className="text-right hidden md:table-cell">تاريخ الدفع</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {payment.teacher?.fullName || getTeacherName(payment.teacherId)}
                          </p>
                          {payment.teacher?.phone && (
                            <p className="text-xs text-muted-foreground" dir="ltr">
                              {payment.teacher.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">
                        {(payment.amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {payment.month ? getMonthName(payment.month) : '—'}
                        <span className="text-xs text-muted-foreground mr-1">
                          {payment.year}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {payment.paymentDate ? (
                          <span className="text-sm" dir="ltr">
                            {payment.paymentDate.split('T')[0]}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePrintBon(payment)}
                            title="طباعة البون"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(payment)}
                            title="تعديل"
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
                            title="حذف"
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

      {/* ─── Add/Edit Dialog ──────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? 'تعديل الدفعة' : 'إضافة دفعة جديدة'}
            </DialogTitle>
            <DialogDescription>
              {editingPayment
                ? 'قم بتعديل بيانات الدفعة'
                : 'أدخل بيانات الدفعة الجديدة - يتم الحساب تلقائياً'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
            {/* Teacher selection */}
            <div>
              <Label>الأستاذ *</Label>
              <Select
                value={form.teacherId}
                onValueChange={handleTeacherSelect}
                disabled={!!editingPayment}
              >
                <SelectTrigger className="w-full mt-1.5">
                  <SelectValue placeholder="اختر الأستاذ" />
                </SelectTrigger>
                <SelectContent>
                  {teachers
                    .filter((t) => t.status === 'active')
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span>{t.fullName}</span>
                          {t.phone && (
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              {t.phone}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-calculation breakdown */}
            {selectedCalc && !editingPayment && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-semibold text-teal-700">
                    الحساب التلقائي
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">عدد التلاميذ</span>
                    <span className="font-bold text-foreground">{selectedCalc.totalStudents}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">نسبة الأستاذ</span>
                    <span className="font-bold text-foreground">{selectedCalc.teacherPercentage}%</span>
                  </div>
                  <div className="flex justify-between items-center col-span-2">
                    <span className="text-muted-foreground">إجمالي المحصل من التلاميذ</span>
                    <span className="font-bold text-foreground">
                      {selectedCalc.totalCollected.toLocaleString()} درهم
                    </span>
                  </div>
                </div>

                {/* Groups breakdown */}
                {selectedCalc.groups.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                      توزيع حسب المجموعات:
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {selectedCalc.groups.map((g, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center text-xs bg-white rounded-md px-3 py-1.5 border border-teal-100"
                        >
                          <span className="text-foreground">
                            {g.subjectNameAr} - {g.levelNameAr}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-xs bg-teal-100 text-teal-700 hover:bg-teal-100"
                          >
                            {g.studentCount} تلميذ
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="bg-teal-200" />

                <div className="flex justify-between items-center">
                  <span className="font-semibold text-teal-700">حصة الأستاذ</span>
                  <span className="text-lg font-extrabold text-teal-700">
                    {selectedCalc.teacherShare.toLocaleString()} درهم
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-teal-300 text-teal-700 hover:bg-teal-100"
                  onClick={handleApplyCalculation}
                >
                  <Calculator className="h-4 w-4" />
                  تطبيق الحصة كالمبلغ ({selectedCalc.teacherShare.toLocaleString()} درهم)
                </Button>
              </div>
            )}

            {/* Amount */}
            <div>
              <Label htmlFor="amount">المبلغ (درهم) *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                dir="ltr"
                className="text-left mt-1.5"
              />
            </div>

            {/* Month / Year */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الشهر *</Label>
                <Select
                  value={form.month}
                  onValueChange={(val) => setForm({ ...form, month: val })}
                >
                  <SelectTrigger className="w-full mt-1.5">
                    <SelectValue placeholder="اختر الشهر" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>السنة</Label>
                <Select
                  value={form.year}
                  onValueChange={(val) => setForm({ ...form, year: val })}
                >
                  <SelectTrigger className="w-full mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment Date */}
            <div>
              <Label htmlFor="paymentDate">تاريخ الدفع</Label>
              <Input
                id="paymentDate"
                type="date"
                value={form.paymentDate}
                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                dir="ltr"
                className="text-left mt-1.5"
              />
            </div>

            {/* Status */}
            <div>
              <Label>الحالة</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm({ ...form, status: val })}
              >
                <SelectTrigger className="w-full mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">مدفوع</SelectItem>
                  <SelectItem value="pending">معلق</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                rows={2}
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t mt-2">
            {editingPayment && (
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => {
                  setFormOpen(false);
                  setDeletingPayment(editingPayment);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                حذف
              </Button>
            )}
            <div className="flex gap-2 w-full sm:w-auto sm:mr-auto">
              <Button
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={submitting}
                className="flex-1 sm:flex-none"
              >
                إلغاء
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none">
                {submitting
                  ? 'جاري الحفظ...'
                  : editingPayment
                  ? 'تحديث الدفعة'
                  : 'إضافة الدفعة'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ──────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الدفعة؟ لا يمكن التراجع عن هذا الإجراء.
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
