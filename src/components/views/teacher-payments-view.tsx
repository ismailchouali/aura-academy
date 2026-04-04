'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'lucide-react';

// Types
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
  teacher: { fullName: string; phone?: string; percentage?: number };
  amount: number;
  month: string;
  year: number;
  paymentDate: string;
  notes: string;
  status: string;
  method?: string;
}

interface PaymentFormData {
  teacherId: string;
  amount: string;
  month: string;
  year: string;
  paymentDate: string;
  notes: string;
  status: string;
  method: string;
}

const monthNames = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
];

const paymentMethods = [
  { value: 'cash', label: 'نقدي' },
  { value: 'transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' },
];

const emptyForm: PaymentFormData = {
  teacherId: '',
  amount: '',
  month: '',
  year: new Date().getFullYear().toString(),
  paymentDate: new Date().toISOString().split('T')[0],
  notes: '',
  status: 'pending',
  method: 'cash',
};

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

function getMethodLabel(method: string) {
  switch (method) {
    case 'cash': return 'نقدي';
    case 'transfer': return 'تحويل بنكي';
    case 'check': return 'شيك';
    default: return method || 'نقدي';
  }
}

function getMonthName(month: string) {
  const idx = parseInt(month) - 1;
  return idx >= 0 && idx < 12 ? monthNames[idx] : month;
}

function generateBonNumber(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `TP-${num}`;
}

function printTeacherBon(payment: TeacherPayment, teacher: Teacher, bonNumber: string) {
  const subjects = teacher.subjects
    .map((ts) => ts.subject.nameAr || ts.subject.name)
    .join('، ');

  const paymentDate = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString('ar-MA')
    : new Date().toLocaleDateString('ar-MA');

  const amountStr = (payment.amount || 0).toLocaleString('ar-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const monthStr = getMonthName(payment.month);
  const yearStr = payment.year;

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>بون دفع أستاذ - ${teacher.fullName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Tajawal', 'Arial', sans-serif;
    background: white;
    display: flex;
    justify-content: center;
    padding: 20px;
  }
  .bon-container {
    width: 100%;
    max-width: 500px;
    border: 3px solid #1a1a2e;
    border-radius: 12px;
    overflow: hidden;
    background: white;
  }
  .bon-header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
    text-align: center;
    padding: 20px;
  }
  .bon-header h1 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 4px;
  }
  .bon-header p {
    font-size: 13px;
    opacity: 0.8;
  }
  .bon-title {
    background: #f0f4f8;
    text-align: center;
    padding: 12px;
    border-bottom: 2px solid #1a1a2e;
  }
  .bon-title h2 {
    font-size: 16px;
    font-weight: 700;
    color: #1a1a2e;
  }
  .bon-number {
    display: flex;
    justify-content: space-between;
    padding: 10px 20px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 12px;
    color: #64748b;
  }
  .bon-section {
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  .bon-section h3 {
    font-size: 11px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .bon-section h3::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px dashed #f1f5f9;
    font-size: 13px;
  }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #64748b; }
  .info-value { font-weight: 600; color: #1e293b; }
  .amount-section {
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
    text-align: center;
  }
  .amount-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
  .amount-value {
    font-size: 28px;
    font-weight: 800;
    color: #166534;
    direction: ltr;
  }
  .amount-currency { font-size: 14px; color: #16a34a; font-weight: 500; }
  .bon-footer {
    padding: 20px;
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
    margin-bottom: 30px;
  }
  .signature-line {
    border-bottom: 1px solid #94a3b8;
    width: 120px;
    margin: 0 auto;
  }
  .bon-watermark {
    position: fixed;
    bottom: 10px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 9px;
    color: #cbd5e1;
  }
  @media print {
    body { padding: 0; }
    .bon-watermark { display: none; }
  }
</style>
</head>
<body>
  <div class="bon-container">
    <div class="bon-header">
      <h1>AURA ACADEMY</h1>
      <p>أكاديميا أورا للدروس الخصوصية والدعم</p>
    </div>
    <div class="bon-title">
      <h2>بون دفع أستاذ / سند دفع</h2>
    </div>
    <div class="bon-number">
      <span>الرقم: #${bonNumber}</span>
      <span>التاريخ: ${paymentDate}</span>
    </div>
    <div class="bon-section">
      <h3>معلومات الأستاذ</h3>
      <div class="info-row">
        <span class="info-label">اسم الأستاذ</span>
        <span class="info-value">${teacher.fullName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الهاتف</span>
        <span class="info-value" dir="ltr">${teacher.phone || '—'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">المواد</span>
        <span class="info-value">${subjects || '—'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">النسبة</span>
        <span class="info-value">${teacher.percentage || 0}%</span>
      </div>
    </div>
    <div class="amount-section">
      <div class="amount-label">المبلغ المستحق</div>
      <div class="amount-value">${amountStr} <span class="amount-currency">درهم</span></div>
    </div>
    <div class="bon-section">
      <h3>تفاصيل الدفع</h3>
      <div class="info-row">
        <span class="info-label">الشهر</span>
        <span class="info-value">${monthStr} ${yearStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">طريقة الدفع</span>
        <span class="info-value">${getMethodLabel(payment.method || 'cash')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">الحالة</span>
        <span class="info-value" style="color: ${payment.status === 'paid' ? '#166534' : '#b45309'};">
          ${payment.status === 'paid' ? '✓ مدفوع' : '⏳ معلق'}
        </span>
      </div>
      ${payment.notes ? `
      <div class="info-row">
        <span class="info-label">ملاحظات</span>
        <span class="info-value">${payment.notes}</span>
      </div>` : ''}
    </div>
    <div class="bon-footer">
      <div class="signature-box">
        <div class="signature-label">توقيع الأستاذ</div>
        <div class="signature-line"></div>
      </div>
      <div class="signature-box">
        <div class="signature-label">توقيع المركز</div>
        <div class="signature-line"></div>
      </div>
    </div>
  </div>
  <div class="bon-watermark">Aura Academy - بني ملال</div>
  <script>
    window.onload = function() {
      window.print();
    }
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=600,height=800');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    toast.error('يرجى السماح بالنوافذ المنبثقة لطباعة البون');
  }
}

export function TeacherPaymentsView() {
  const [payments, setPayments] = useState<TeacherPayment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchPayments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterTeacherId && filterTeacherId !== 'all')
        params.set('teacherId', filterTeacherId);
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

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  // Form handlers
  const openCreateDialog = () => {
    setEditingPayment(null);
    setForm(emptyForm);
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
      method: (payment as Record<string, unknown>).method as string || 'cash',
    });
    setFormOpen(true);
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
        year: parseInt(form.year) || new Date().getFullYear(),
        paymentDate: form.paymentDate ? new Date(form.paymentDate).toISOString() : null,
        notes: form.notes,
        status: form.status,
        method: form.method,
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

      toast.success(
        editingPayment ? 'تم تحديث الدفعة بنجاح' : 'تم إضافة الدفعة بنجاح'
      );
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
    if (!teacher) {
      toast.error('لم يتم العثور على بيانات الأستاذ');
      return;
    }
    const bonNumber = generateBonNumber();
    printTeacherBon(payment, teacher, bonNumber);
  };

  const getTeacherName = (teacherId: string) =>
    teachers.find((t) => t.id === teacherId)?.fullName || teacherId;

  // Calculate totals
  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPending = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Years for filter
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">مداخيل الأساتذة</h2>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة ومتابعة مدفوعات الأساتذة وبونات الدفع
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة دفعة
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CircleDollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي المدفوعات</p>
                <p className="text-xl font-bold text-emerald-600">
                  {totalPaid.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-muted-foreground">درهم</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">في انتظار الدفع</p>
                <p className="text-xl font-bold text-amber-600">
                  {totalPending.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-muted-foreground">درهم</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">عدد الدفعات</p>
                <p className="text-xl font-bold text-sky-600">{payments.length}</p>
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

      {/* Table */}
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
              <p className="text-lg font-medium text-muted-foreground">
                لا توجد مدفوعات
              </p>
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
                    <TableHead className="text-right hidden lg:table-cell">طريقة الدفع</TableHead>
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
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {getMethodLabel((payment as Record<string, unknown>).method as string || 'cash')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>
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

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? 'تعديل الدفعة' : 'إضافة دفعة جديدة'}
            </DialogTitle>
            <DialogDescription>
              {editingPayment
                ? 'قم بتعديل بيانات الدفعة'
                : 'أدخل بيانات الدفعة الجديدة'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto -mx-6 px-6">
            {/* Teacher selection */}
            <div>
              <Label>الأستاذ *</Label>
              <Select
                value={form.teacherId}
                onValueChange={(val) => setForm({ ...form, teacherId: val })}
              >
                <SelectTrigger className="w-full mt-1.5">
                  <SelectValue placeholder="اختر الأستاذ" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
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
                onChange={(e) =>
                  setForm({ ...form, paymentDate: e.target.value })
                }
                dir="ltr"
                className="text-left mt-1.5"
              />
            </div>

            {/* Payment Method */}
            <div>
              <Label>طريقة الدفع</Label>
              <Select
                value={form.method}
                onValueChange={(val) => setForm({ ...form, method: val })}
              >
                <SelectTrigger className="w-full mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <Label>الحالة</Label>
              <Select
                value={form.status}
                onValueChange={(val) =>
                  setForm({ ...form, status: val })
                }
              >
                <SelectTrigger className="w-full mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">معلق</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
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

      {/* Delete Confirmation */}
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
