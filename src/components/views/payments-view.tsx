'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { useT } from '@/hooks/use-translation';

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
      subject: { nameAr: string; service?: { nameAr: string; id: string } | null } | null;
    } | null;
    teacher: { id: string; fullName: string } | null;
  };
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  discount: number;
  packMonths: number;
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
  packMonths?: number;
  level: {
    nameAr: string;
    subject: { nameAr: string; service?: { nameAr: string; id: string } | null } | null;
  } | null;
  teacher: { id: string; fullName: string } | null;
}

interface PaymentFormData {
  studentId: string;
  amount: number | '';
  paidAmount: number | '';
  discount: number | '';
  packMonths: number;
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
  packMonths: 1,
  month: '',
  year: new Date().getFullYear(),
  paymentDate: new Date().toISOString().split('T')[0],
  method: 'cash',
  notes: '',
  status: 'pending',
};

const MONTH_KEYS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

export function PaymentsView() {
  const t = useT();

  // ── Derived month data ──
  const MONTHS = useMemo(() =>
    MONTH_KEYS.map((key) => ({
      value: key,
      label: t.months[key],
    })),
  [t]);

  const MONTH_NAMES = useMemo(() =>
    Object.fromEntries(MONTHS.map((m) => [m.value, m.label])),
  [MONTHS]);

  const PAYMENT_METHODS = useMemo(() => [
    { value: 'cash', label: t.payments.cash },
    { value: 'transfer', label: t.payments.transfer },
    { value: 'check', label: t.payments.check },
  ], [t]);

  const PACK_OPTIONS = useMemo(() => [
    { value: 1, label: t.payments.pack1 },
    { value: 3, label: t.payments.pack3 },
    { value: 6, label: t.payments.pack6 },
    { value: 9, label: t.payments.pack9 },
  ], [t]);

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
            {t.payments.statusPaid}
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
            {t.payments.statusPartial}
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
            {t.payments.statusPending}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }, [t]);

  const getMethodLabel = useCallback((method: string | null) => {
    switch (method) {
      case 'cash':
        return t.payments.cash;
      case 'transfer':
        return t.payments.transfer;
      case 'check':
        return t.payments.check;
      default:
        return method || '—';
    }
  }, [t]);

  const generateBon = useCallback((payment: Payment) => {
    const student = payment.student;
    const monthLabel = MONTH_NAMES[payment.month] || payment.month;
    const paymentDate = payment.paymentDate ? formatDate(payment.paymentDate) : '—';
    const netAmount = payment.amount - payment.discount;

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${t.payments.bonPrint}</title>
  <base href="${typeof window !== 'undefined' ? window.location.origin + '/' : '/'}">
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
      margin-top: 8px;
      margin-bottom: 0;
    }
    .header .logo {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      object-fit: cover;
      display: block;
      margin: 0 auto;
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
      justify-content: center;
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
    .bon-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #475569;
      line-height: 1.8;
    }
    .bon-footer .phone-line {
      font-weight: 600;
      direction: ltr;
      display: inline-block;
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
  <div class="bon">
    <div class="header">
      <img src="/logo.png" alt="Aura Academy" class="logo">
      <h1>Aura Academy</h1>
    </div>
    <div class="divider"></div>
    <div class="info-section">
      <div class="info-item">
        <span class="label">${t.payments.bonStudentName}: </span>
        <span class="value">${student.fullName}</span>
      </div>
      <div class="info-item">
        <span class="label">${t.common.phone}: </span>
        <span class="value" dir="ltr">${student.phone || '—'}</span>
      </div>
    </div>
    <table class="details-table">
      <thead>
        <tr>
          <th>${t.payments.bonStatement}</th>
          <th class="amount">${t.payments.bonAmountDh}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${t.payments.bonRequired}</td>
          <td class="amount">${payment.amount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>
        ${payment.discount > 0 ? `<tr>
          <td>${t.payments.bonDiscount}</td>
          <td class="amount amber">- ${payment.discount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td>${t.payments.bonAfterDiscount}</td>
          <td class="amount">${netAmount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>` : ''}
        <tr>
          <td>${t.payments.bonPaid}</td>
          <td class="amount green">${payment.paidAmount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td>${t.payments.bonRemaining}</td>
          <td class="amount red">${payment.remainingAmount.toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td>${t.payments.bonMonthYear}</td>
          <td>${monthLabel} ${payment.year}${payment.packMonths > 1 ? ` (${t.payments.packBadge} ${payment.packMonths} ${t.payments.packMonthsUnit})` : ''}</td>
        </tr>
        ${payment.packMonths > 1 ? `<tr>
          <td>${t.payments.packMonthlyEquiv}</td>
          <td class="amount">${Math.round(payment.amount / payment.packMonths).toLocaleString('ar-MA', { minimumFractionDigits: 2 })}</td>
        </tr>` : ''}
        <tr>
          <td>${t.payments.bonPaymentDate}</td>
          <td dir="ltr" style="text-align:right">${paymentDate}</td>
        </tr>
      </tbody>
    </table>
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">${t.payments.bonParentSig}</div>
        <div class="sig-line"></div>
      </div>
    </div>
    <div class="bon-footer">
      <div class="phone-line">${t.payments.bonPhone}</div>
      <div>${t.payments.bonAddress}</div>
    </div>
  </div>
  <div class="no-print" style="text-align:center; margin-top:16px;">
    <button onclick="window.print()">${t.payments.bonPrint}</button>
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
  }, [t, MONTH_NAMES]);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Student search state
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<StudentSearchResult[]>([]);
  const [allStudents, setAllStudents] = useState<StudentSearchResult[]>([]);
  const [studentSearching, setStudentSearching] = useState(false);
  const studentsLoaded = useRef(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [yearlyPaid, setYearlyPaid] = useState(0);

  // Check if selected student belongs to Langues service
  const isLanguesService = useMemo(() => {
    return selectedStudent?.level?.subject?.service?.id === 'service_langues';
  }, [selectedStudent]);

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
      toast.error(t.payments.fetchError);
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterStatus, t]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // ── Load all students (for payment dialog) ─────────────────────────

  const loadAllStudents = useCallback(async () => {
    setStudentSearching(true);
    try {
      const res = await fetch('/api/students');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAllStudents(json);
      setStudentSearchResults(json);
    } catch {
      console.error('Failed to load students for payment dialog');
      setAllStudents([]);
      setStudentSearchResults([]);
    } finally {
      setStudentSearching(false);
    }
  }, []);

  // ── Student search (local filtering – no API calls) ────────────────

  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery || studentSearchQuery.length < 1) {
      return allStudents;
    }
    const q = studentSearchQuery.toLowerCase();
    return allStudents.filter((s) => {
      const name = (s.fullName || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      const parentPhone = (s.parentPhone || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || parentPhone.includes(q);
    });
  }, [studentSearchQuery, allStudents]);

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
      toast.error(t.payments.overdueFetchError);
    } finally {
      setOverdueLoading(false);
    }
  }, [t]);

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
        packMonths: payment.packMonths || 1,
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
      // Load all students once when opening add dialog
      if (!studentsLoaded.current) {
        studentsLoaded.current = true;
        loadAllStudents();
      } else {
        // Already loaded, just show them
        setStudentSearchResults(allStudents);
      }
    }
    setDialogOpen(true);
  };

  const handleSelectStudent = (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setStudentSearchQuery('');
    setFormData((prev) => ({
      ...prev,
      studentId: student.id,
      amount: student.monthlyFee || '',
      packMonths: student.level?.subject?.service?.id === 'service_langues'
        ? (student.packMonths || prev.packMonths)
        : 1,
    }));
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setStudentSearchQuery('');
    setFormData((prev) => ({ ...prev, studentId: '', amount: '', packMonths: 1 }));
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
      toast.error(t.payments.studentRequired);
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error(t.payments.amountRequired);
      return;
    }
    if (!formData.month) {
      toast.error(t.payments.monthRequired);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        paidAmount: Number(formData.paidAmount) || 0,
        discount: Number(formData.discount) || 0,
        packMonths: formData.packMonths || 1,
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
        editingPayment ? t.payments.updateSuccess : t.payments.addSuccess
      );

      // Offer to print bon for new payments
      if (!editingPayment) {
        const savedPayment = await res.json();
        setDialogOpen(false);
        fetchPayments();
        setTimeout(() => {
          if (confirm(t.common.printQuestion)) {
            generateBon(savedPayment);
          }
        }, 300);
        return;
      }

      setDialogOpen(false);
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
      const res = await fetch(`/api/payments/${deletingPayment.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success(t.payments.deleteSuccess);
      setDeleteOpen(false);
      setDeletingPayment(null);
      fetchPayments();
    } catch {
      toast.error(t.common.deleteError);
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
          <span className="text-sm">{payments.length} {t.payments.paymentCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleOpenOverdue}
            className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          >
            <AlertTriangle className="h-4 w-4" />
            {t.payments.overdue}
          </Button>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            {t.payments.addPayment}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t.payments.requiredAmount}</p>
            <p className="text-lg font-bold mt-1">
              {totalAmount.toLocaleString()}{' '}
              <span className="text-xs font-normal">{t.common.dh}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t.payments.discount}</p>
            <p className="text-lg font-bold text-amber-600 mt-1">
              {totalDiscount.toLocaleString()}{' '}
              <span className="text-xs font-normal">{t.common.dh}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t.payments.paid}</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">
              {totalPaid.toLocaleString()}{' '}
              <span className="text-xs font-normal">{t.common.dh}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t.payments.remaining}</p>
            <p className="text-lg font-bold text-red-600 mt-1">
              {totalRemaining.toLocaleString()}{' '}
              <span className="text-xs font-normal">{t.common.dh}</span>
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
                  <SelectValue placeholder={t.payments.allMonths} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.payments.allMonths}</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder={t.payments.year}
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                dir="ltr"
                className="w-full"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.payments.allStatuses} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.payments.allStatuses}</SelectItem>
                  <SelectItem value="paid">{t.payments.statusPaid}</SelectItem>
                  <SelectItem value="partial">{t.payments.statusPartial}</SelectItem>
                  <SelectItem value="pending">{t.payments.statusPending}</SelectItem>
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
              <p className="font-medium">{t.payments.noPayments}</p>
              <p className="text-sm mt-1">
                {t.payments.addFirst}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{t.payments.studentCol}</TableHead>
                    <TableHead className="text-right">{t.payments.monthYearCol}</TableHead>
                    <TableHead className="text-right hidden md:table-cell">
                      {t.payments.amountCol}
                    </TableHead>
                    <TableHead className="text-right hidden md:table-cell">
                      {t.payments.paidCol}
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">
                      {t.payments.remainingCol}
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">
                      {t.payments.discountCol}
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">
                      {t.payments.dateCol}
                    </TableHead>
                    <TableHead className="text-right">{t.common.status}</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
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
                            {payment.student.level && payment.student.level.subject && (
                              <span>
                                {payment.student.level.subject.nameAr} -{' '}
                                {payment.student.level.nameAr}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>
                            {MONTH_NAMES[payment.month] || payment.month}{' '}
                            {payment.year}
                          </span>
                          {payment.packMonths > 1 && (
                            <Badge className="bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100 text-[10px] px-1.5 py-0">
                              {t.payments.packBadge} {payment.packMonths} {t.payments.packMonthsUnit}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell font-medium">
                        {payment.amount.toLocaleString()}{' '}
                        <span className="text-xs font-normal">{t.common.dh}</span>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell text-emerald-600">
                        {payment.paidAmount.toLocaleString()}{' '}
                        <span className="text-xs font-normal">{t.common.dh}</span>
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-red-600">
                        {payment.remainingAmount.toLocaleString()}{' '}
                        <span className="text-xs font-normal">{t.common.dh}</span>
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-amber-600">
                        {payment.discount > 0 ? (
                          <span>
                            {payment.discount.toLocaleString()}{' '}
                            <span className="text-xs font-normal">{t.common.dh}</span>
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
                            title={t.common.printBon}
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
              {editingPayment ? t.payments.editPayment : t.payments.addNew}
            </DialogTitle>
            <DialogDescription>
              {editingPayment
                ? t.payments.editDesc
                : t.payments.addDesc}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="grid gap-4 pb-6 pt-2">
              {/* ── Student Search ─────────────────────────────────────── */}
              {!editingPayment && !selectedStudent && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">
                    {t.payments.searchStudent}
                  </Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t.payments.searchStudentPlaceholder}
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
                    filteredStudents.length > 0 &&
                    !selectedStudent && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                        {filteredStudents.map((s) => (
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
                                {s.level && s.level.subject && (
                                  <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">
                                    {s.level.subject.nameAr} -{' '}
                                    {s.level.nameAr}
                                  </span>
                                )}
                                {s.monthlyFee > 0 && (
                                  <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                                    {s.monthlyFee.toLocaleString()} {t.common.month}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                  {!studentSearching &&
                    allStudents.length > 0 &&
                    filteredStudents.length === 0 &&
                    !selectedStudent && (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        {t.payments.noStudentFound}
                      </div>
                    )}
                </div>
              )}

              {/* ── Selected Student Profile Card ──────────────────────── */}
              {selectedStudent && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      {t.payments.selectedStudent}
                    </Label>
                    {!editingPayment && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearStudent}
                        className="h-7 text-xs text-muted-foreground"
                      >
                        <X className="h-3 w-3 ml-1" />
                        {t.common.edit}
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
                            {t.common.name}:{' '}
                          </span>
                          <span className="font-bold">
                            {selectedStudent.fullName}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            {t.common.phone}:{' '}
                          </span>
                          <span className="font-medium" dir="ltr">
                            {selectedStudent.phone || '—'}
                          </span>
                        </div>
                        {selectedStudent.parentName && (
                          <div>
                            <span className="text-muted-foreground">
                              {t.students.parentName}:{' '}
                            </span>
                            <span className="font-medium">
                              {selectedStudent.parentName}
                            </span>
                          </div>
                        )}
                        {selectedStudent.parentPhone && (
                          <div>
                            <span className="text-muted-foreground">
                              {t.students.parentPhone}:{' '}
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
                            {t.students.monthlyFeeSection}:{' '}
                          </span>
                          <span className="font-bold text-teal-700">
                            {selectedStudent.monthlyFee.toLocaleString()}{' '}
                            {t.common.dh}
                          </span>
                        </div>
                        {selectedStudent.level && selectedStudent.level.subject && (
                          <div>
                            <span className="text-muted-foreground">
                              {t.students.level}:{' '}
                            </span>
                            <span className="font-medium">
                              {selectedStudent.level.subject.nameAr} -{' '}
                              {selectedStudent.level.nameAr}
                            </span>
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <span className="text-muted-foreground">
                            {t.common.dh} ({new Date().getFullYear()}):{' '}
                          </span>
                          <span className="font-bold text-emerald-600">
                            {yearlyPaid.toLocaleString()} {t.common.dh}
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
                  {t.common.amount}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">{t.payments.bonAmountDh} *</Label>
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
                    <Label htmlFor="discount">{t.payments.bonDiscount} ({t.common.dh})</Label>
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
                    <Label htmlFor="paidAmount">{t.payments.bonPaid} ({t.common.dh})</Label>
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
                    <Label>{t.payments.remaining}</Label>
                    <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm">
                      <span dir="ltr">
                        {Math.max(0, remainingAmount).toLocaleString()}
                      </span>
                      <span className="mr-1 text-muted-foreground text-xs">
                        {t.common.dh}
                      </span>
                    </div>
                  </div>
                </div>
                {discountValue > 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 rounded-md p-2">
                    {t.payments.bonAfterDiscount}:{' '}
                    <strong>{netAmount.toLocaleString()} {t.common.dh}</strong>
                  </div>
                )}
                {formData.packMonths > 1 && typeof formData.amount === 'number' && formData.amount > 0 && (
                  <div className="text-xs bg-teal-50 text-teal-700 rounded-md p-2">
                    {t.payments.packMonthlyEquiv}:{' '}
                    <strong>{Math.round(formData.amount / formData.packMonths).toLocaleString()} {t.common.dh} / {t.common.month}</strong>
                  </div>
                )}
              </div>

              {/* ── Pack Type (Langues only) ───────────────────────────── */}
              {isLanguesService && (
                <div className="space-y-1.5">
                  <Label>{t.payments.packType}</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PACK_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, packMonths: opt.value })
                        }
                        className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                          formData.packMonths === opt.value
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-muted bg-card hover:border-teal-200 hover:bg-teal-50/50 text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Month / Year / Date / Method ────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>{t.payments.month} *</Label>
                  <Select
                    value={formData.month}
                    onValueChange={(val) =>
                      setFormData({ ...formData, month: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t.payments.chooseMonth} />
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
                  <Label>{t.payments.year} *</Label>
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
                  <Label>{t.payments.bonPaymentDate}</Label>
                  <Input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        paymentDate: e.target.value,
                      })
                    }
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.payments.paymentMethod}</Label>
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
                <Label htmlFor="notes">{t.common.notes}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder={`${t.common.notes} (${t.common.optional})`}
                  rows={2}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 pb-6 pt-2 border-t bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-muted-foreground">
                {t.common.status}:{' '}
                {autoStatus === 'paid'
                  ? t.payments.statusPaid
                  : autoStatus === 'partial'
                    ? t.payments.statusPartial
                    : t.payments.statusPending}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="gap-2"
                >
                  {submitting ? (
                    <span className="animate-spin">⏳</span>
                  ) : null}
                  {editingPayment ? t.common.saveChanges : t.payments.addPayment}
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
              {t.payments.overdue}
            </DialogTitle>
            <DialogDescription>
              {t.payments.overdueDesc}
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
              <p className="font-medium">{t.common.noData}</p>
              <p className="text-sm mt-1">{t.common.noData}</p>
            </div>
          ) : (
            <>
              {/* Grand total bar */}
              <div className="mx-6 mt-2 mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-800">
                  {t.common.total}
                </span>
                <span className="text-lg font-bold text-amber-700">
                  {grandTotalOverdue.toLocaleString()}{' '}
                  <span className="text-sm font-normal">{t.common.dh}</span>
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
                          {service.studentCount} {t.students.studentCount} —{' '}
                          {service.totalOverdue.toLocaleString()} {t.common.dh}
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
                                        {t.students.guardian}{student.parentName}
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
                                      {t.common.dh}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-red-200 text-red-600"
                                    >
                                      {student.paymentCount} {t.payments.month}
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
            <AlertDialogTitle>{t.common.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.common.deleteConfirmMsg} {t.common.cannotUndo}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
