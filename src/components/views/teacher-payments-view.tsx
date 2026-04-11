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
import { useT } from '@/hooks/use-translation';
import type { Translations } from '@/lib/translations';

// ─── Types ───────────────────────────────────────────────────────────

interface Teacher {
  id: string;
  fullName: string;
  phone?: string;
  percentage?: number;
  status?: string;
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

const MONTH_KEYS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const emptyForm: PaymentFormData = {
  teacherId: '',
  amount: '',
  month: String(new Date().getMonth() + 1),
  year: new Date().getFullYear().toString(),
  paymentDate: new Date().toISOString().split('T')[0],
  notes: '',
  status: 'paid',
};

// ─── Bon (Receipt) Printer ───────────────────────────────────────────

function printTeacherBon(
  payment: TeacherPayment,
  teacher: Teacher | undefined,
  calcData: CalculationData | undefined,
  t: Translations,
  getMonthName: (month: string) => string
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

  const groups = calcData?.groups || [];
  const totalStudents = calcData?.totalStudents || groups.reduce((s, g) => s + g.studentCount, 0);

  let groupsTableHTML = '';
  if (groups.length > 0) {
    groupsTableHTML = `
      <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:12px;">
        <thead>
          <tr style="background:#f0fdfa;">
            <th style="border:1px solid #d1d5db; padding:6px 10px; text-align:right; font-weight:600;">#</th>
            <th style="border:1px solid #d1d5db; padding:6px 10px; text-align:right; font-weight:600;">${t.teacherPayments.bonSubjectLevel}</th>
            <th style="border:1px solid #d1d5db; padding:6px 10px; text-align:center; font-weight:600;">${t.teacherPayments.bonStudentCountCol}</th>
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
            <td colspan="2" style="border:1px solid #d1d5db; padding:6px 10px; text-align:right;">${t.teacherPayments.bonTotalRow}</td>
            <td style="border:1px solid #d1d5db; padding:6px 10px; text-align:center;">${totalStudents}</td>
          </tr>
        </tbody>
      </table>`;
  }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>${t.teacherPayments.bonTitle} - ${teacherName}</title>
<base href="${typeof window !== 'undefined' ? window.location.origin + '/' : '/'}">
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
    background: white;
    color: #0d9488;
    text-align: center;
    padding: 14px 20px;
    border-bottom: 2px solid #0d9488;
  }
  .bon-header img {
    max-height: 80px;
    display: block;
    margin: 0 auto;
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
      <img src="/logo.jpg" alt="Aura Academy">
      <h1>Aura Academy</h1>
    </div>

    <div class="bon-title-bar">
      <h2>${t.teacherPayments.bonTitle}</h2>
    </div>

    <div class="bon-info">
      <div class="info-row">
        <span class="info-label">${t.teacherPayments.bonTeacherName}</span>
        <span class="info-value">${teacherName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${t.teacherPayments.bonPhone}</span>
        <span class="info-value" dir="ltr">${teacherPhone}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${t.teacherPayments.bonSubjects}</span>
        <span class="info-value" style="font-size:11px;">${subjects}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${t.teacherPayments.bonDate}</span>
        <span class="info-value" dir="ltr">${day} / ${month} / ${year}</span>
      </div>
    </div>

    ${groups.length > 0 ? `
    <div class="bon-groups">
      <h3>${t.teacherPayments.bonGroupsTitle}</h3>
      ${groupsTableHTML}
    </div>` : ''}

    <div class="amount-box">
      <div class="amount-label">${t.teacherPayments.bonAmountDue}</div>
      <div class="amount-value">${amountStr} <span class="amount-currency">${t.common.dh}</span></div>
    </div>

    <div class="bon-details">
      <h3>${t.teacherPayments.bonDetails}</h3>
      <div class="info-row">
        <span class="info-label">${t.teacherPayments.bonMonth}</span>
        <span class="info-value">${monthStr} ${yearStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${t.teacherPayments.bonPaymentDate}</span>
        <span class="info-value" dir="ltr">${day} / ${month} / ${year}</span>
      </div>
      ${payment.notes ? `
      <div class="info-row">
        <span class="info-label">${t.common.notes}</span>
        <span class="info-value">${payment.notes}</span>
      </div>` : ''}
    </div>

    <div class="bon-footer">
      <div class="phone-line">${t.payments.bonPhone}</div>
      <div>${t.payments.bonAddress}</div>
    </div>
  </div>

  <div class="no-print" style="text-align:center; margin-top:12px;">
    <button onclick="window.print()" style="padding:8px 24px; background:#0d9488; color:white; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-size:14px;">${t.teacherPayments.bonPrint}</button>
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
    toast.error(t.common.noInternet);
  }
}

// ─── Main Component ──────────────────────────────────────────────────

export function TeacherPaymentsView() {
  const t = useT();

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

  // ─── Helpers (inside component for t access) ────────────────────────

  const monthNames = useMemo(() => MONTH_KEYS.map((k) => t.months[k]), [t]);

  const getMonthName = useCallback((month: string) => {
    const idx = parseInt(month) - 1;
    return idx >= 0 && idx < 12 ? monthNames[idx] : month;
  }, [monthNames]);

  function getStatusBadge(status: string) {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">{t.teacherPayments.statusPaid}</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">{t.teacherPayments.statusPending}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

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
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPayments(data);
    } catch {
      toast.error(t.teacherPayments.fetchError);
    } finally {
      setLoading(false);
    }
  }, [filterTeacherId, filterMonth, filterYear, filterStatus]);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTeachers(data);
    } catch {
      toast.error(t.teacherPayments.fetchTeachersError);
    }
  }, []);

  const fetchCalcData = useCallback(async (teacherId?: string, calcMonth?: string, calcYear?: string) => {
    setCalcLoading(true);
    try {
      const params = new URLSearchParams({ calculate: 'true' });
      if (teacherId) params.set('teacherId', teacherId);
      if (calcMonth) params.set('month', calcMonth);
      if (calcYear) params.set('year', calcYear);
      const res = await fetch(`/api/teacher-payments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setCalcData(data);
    } catch {
      toast.error(t.teacherPayments.calcFetchError);
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

  // Re-fetch calculation data when month/year changes in the form (if dialog is open with a teacher)
  useEffect(() => {
    if (formOpen && form.teacherId && !editingPayment) {
      fetchCalcData(form.teacherId, form.month, form.year);
    }
  }, [form.month, form.year, formOpen, form.teacherId, editingPayment, fetchCalcData]);

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

  const selectedCalc = useMemo(() => {
    if (!form.teacherId) return null;
    return calcData.find((c) => c.teacherId === form.teacherId) || null;
  }, [form.teacherId, calcData]);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  // ─── Form Handlers ────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingPayment(null);
    const currentM = String(now.getMonth() + 1);
    const currentY = String(now.getFullYear());
    setForm({
      ...emptyForm,
      month: currentM,
      year: currentY,
      paymentDate: now.toISOString().split('T')[0],
    });
    fetchCalcData(undefined, currentM, currentY);
    setFormOpen(true);
  };

  const openEditDialog = (payment: TeacherPayment) => {
    setEditingPayment(payment);
    const editMonth = payment.month || '';
    const editYear = payment.year ? String(payment.year) : '';
    setForm({
      teacherId: payment.teacherId,
      amount: payment.amount ? String(payment.amount) : '',
      month: editMonth,
      year: editYear,
      paymentDate: payment.paymentDate ? payment.paymentDate.split('T')[0] : '',
      notes: payment.notes || '',
      status: payment.status,
    });
    fetchCalcData(payment.teacherId, editMonth, editYear);
    setFormOpen(true);
  };

  const handleTeacherSelect = (teacherId: string) => {
    setForm((prev) => ({
      ...prev,
      teacherId,
      amount: '',
    }));
    // Re-fetch calculation with current month/year for the selected teacher
    fetchCalcData(teacherId, form.month, form.year);
  };

  const handleApplyCalculation = () => {
    if (selectedCalc) {
      setForm((prev) => ({
        ...prev,
        amount: String(Math.round(selectedCalc.teacherShare * 100) / 100),
      }));
      toast.success(t.teacherPayments.calcApplied);
    }
  };

  const handleSubmit = async () => {
    if (!form.teacherId) {
      toast.error(t.teacherPayments.teacherRequired);
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error(t.teacherPayments.amountRequired);
      return;
    }
    if (!form.month) {
      toast.error(t.teacherPayments.monthRequired);
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

      if (!res.ok) throw new Error('Failed');

      toast.success(editingPayment ? t.teacherPayments.updateSuccess : t.teacherPayments.addSuccess);
      setFormOpen(false);
      fetchPayments();
    } catch {
      toast.error(t.common.saveError);
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
      if (!res.ok) throw new Error('Failed');
      toast.success(t.teacherPayments.deleteSuccess);
      setDeleteOpen(false);
      setDeletingPayment(null);
      fetchPayments();
    } catch {
      toast.error(t.common.deleteError);
    }
  };

  const handlePrintBon = (payment: TeacherPayment) => {
    const teacher = teachers.find((t) => t.id === payment.teacherId);
    const teacherCalc = calcData.find((c) => c.teacherId === payment.teacherId);
    printTeacherBon(payment, teacher, teacherCalc, t, getMonthName);
  };

  const getTeacherName = (teacherId: string) =>
    teachers.find((t) => t.id === teacherId)?.fullName || teacherId;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t.teacherPayments.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.teacherPayments.subtitle}
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          {t.teacherPayments.addPayment}
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
                <p className="text-xs text-muted-foreground">{t.teacherPayments.thisMonthTotal}</p>
                <p className="text-xl font-bold text-teal-600">
                  {totalThisMonth.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-muted-foreground">{t.common.dh}</span>
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
                <p className="text-xs text-muted-foreground">{t.teacherPayments.thisYearTotal}</p>
                <p className="text-xl font-bold text-amber-600">
                  {totalThisYear.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-muted-foreground">{t.common.dh}</span>
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
                <p className="text-xs text-muted-foreground">{t.teacherPayments.paidTeachersCount}</p>
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
            <span className="text-sm font-medium">{t.teacherPayments.filter}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={filterTeacherId} onValueChange={setFilterTeacherId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.teacherPayments.allTeachers} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.teacherPayments.allTeachers}</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.teacherPayments.allMonths} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.teacherPayments.allMonths}</SelectItem>
                {monthNames.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.teacherPayments.allYears} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.teacherPayments.allYears}</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.teacherPayments.allStatuses} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.teacherPayments.allStatuses}</SelectItem>
                <SelectItem value="paid">{t.teacherPayments.statusPaid}</SelectItem>
                <SelectItem value="pending">{t.teacherPayments.statusPending}</SelectItem>
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
              <p className="text-lg font-medium text-muted-foreground">{t.teacherPayments.noPayments}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {filterTeacherId !== 'all' || filterMonth !== 'all' || filterYear !== 'all' || filterStatus !== 'all'
                  ? t.common.noResults
                  : t.teacherPayments.startAdding}
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{t.teacherPayments.teacherCol}</TableHead>
                    <TableHead className="text-right">{t.teacherPayments.amountCol}</TableHead>
                    <TableHead className="text-right hidden md:table-cell">{t.teacherPayments.monthCol}</TableHead>
                    <TableHead className="text-right hidden md:table-cell">{t.teacherPayments.dateCol}</TableHead>
                    <TableHead className="text-right">{t.teacherPayments.statusCol}</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
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
                            title={t.teacherPayments.printBon}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(payment)}
                            title={t.common.edit}
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
                            title={t.common.delete}
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
              {editingPayment ? t.teacherPayments.editPayment : t.teacherPayments.addNew}
            </DialogTitle>
            <DialogDescription>
              {editingPayment
                ? t.teacherPayments.editDesc
                : t.teacherPayments.addDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
            {/* Teacher selection */}
            <div>
              <Label>{t.teacherPayments.selectTeacher}</Label>
              <Select
                value={form.teacherId}
                onValueChange={handleTeacherSelect}
                disabled={!!editingPayment}
              >
                <SelectTrigger className="w-full mt-1.5">
                  <SelectValue placeholder={t.teacherPayments.chooseTeacher} />
                </SelectTrigger>
                <SelectContent>
                  {teachers
                    .filter((teacher) => teacher.status === 'active')
                    .map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        <span className="flex items-center gap-2">
                          <span>{teacher.fullName}</span>
                          {teacher.phone && (
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              {teacher.phone}
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
                    {t.teacherPayments.autoCalc}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t.teacherPayments.studentCountLabel}</span>
                    <span className="font-bold text-foreground">{selectedCalc.totalStudents}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t.teacherPayments.teacherPercentage}</span>
                    <span className="font-bold text-foreground">{selectedCalc.teacherPercentage}%</span>
                  </div>
                  <div className="flex justify-between items-center col-span-2">
                    <span className="text-muted-foreground">{t.teacherPayments.totalCollected}</span>
                    <span className="font-bold text-foreground">
                      {selectedCalc.totalCollected.toLocaleString()} {t.common.dh}
                    </span>
                  </div>
                </div>

                {selectedCalc.groups.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                      {t.teacherPayments.groupsBreakdown}
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
                            {g.studentCount} {t.teacherPayments.studentUnit}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="bg-teal-200" />

                <div className="flex justify-between items-center">
                  <span className="font-semibold text-teal-700">{t.teacherPayments.teacherShare}</span>
                  <span className="text-lg font-extrabold text-teal-700">
                    {selectedCalc.teacherShare.toLocaleString()} {t.common.dh}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-teal-300 text-teal-700 hover:bg-teal-100"
                  onClick={handleApplyCalculation}
                >
                  <Calculator className="h-4 w-4" />
                  {t.teacherPayments.applyCalc} ({selectedCalc.teacherShare.toLocaleString()} {t.common.dh})
                </Button>
              </div>
            )}

            {/* Amount */}
            <div>
              <Label htmlFor="amount">{t.teacherPayments.amountLabel}</Label>
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
                <Label>{t.teacherPayments.monthLabel}</Label>
                <Select
                  value={form.month}
                  onValueChange={(val) => setForm({ ...form, month: val })}
                >
                  <SelectTrigger className="w-full mt-1.5">
                    <SelectValue placeholder={t.teacherPayments.chooseMonth} />
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
                <Label>{t.teacherPayments.yearLabel}</Label>
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
              <Label htmlFor="paymentDate">{t.teacherPayments.paymentDateLabel}</Label>
              <Input
                id="paymentDate"
                type="date"
                value={form.paymentDate}
                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                className="mt-1.5"
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">{t.teacherPayments.notesLabel}</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1.5"
                placeholder={t.teacherPayments.notesLabel}
                rows={3}
              />
            </div>

            {/* Status */}
            <div>
              <Label>{t.teacherPayments.statusCol}</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm({ ...form, status: val })}
              >
                <SelectTrigger className="w-full mt-1.5">
                  <SelectValue placeholder={t.teacherPayments.statusCol} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">{t.teacherPayments.statusPaid}</SelectItem>
                  <SelectItem value="pending">{t.teacherPayments.statusPending}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ───────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.common.cannotUndo}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {submitting ? t.common.loading : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
