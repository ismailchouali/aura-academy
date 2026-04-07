'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ViewType } from '@/store/store';
import {
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Receipt,
  CalendarDays,
  GraduationCap,
  DollarSign,
  ArrowLeft,
  Phone,
  Calendar,
  BookOpen,
} from 'lucide-react';

interface DashboardData {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  activeTeachers: number;
  totalPayments: number;
  paidPayments: number;
  pendingPayments: number;
  totalRevenue: number;
  totalExpected: number;
  totalRemaining: number;
  monthlyIncome: number;
  currentYear: number;
  currentMonth: number;
  monthlyStats: Record<
    string,
    { revenue: number; expected: number; remaining: number; count: number }
  >;
  recentPayments: {
    id: string;
    student: {
      fullName: string;
      phone?: string;
      level?: {
        nameAr: string;
        subject?: { nameAr: string; service?: { nameAr: string } };
      };
      teacher?: { fullName: string };
    };
    amount: number;
    paidAmount: number;
    month: string;
    year: number;
    status: string;
    createdAt: string;
  }[];
  recentStudents: {
    id: string;
    fullName: string;
    phone?: string;
    enrollmentDate: string;
    status: string;
    monthlyFee: number;
    level?: {
      nameAr: string;
      subject?: { nameAr: string; service?: { nameAr: string } };
    };
    teacher?: { fullName: string };
  }[];
  teacherPaymentsThisYear: number;
}

const ARABIC_MONTHS: Record<string, string> = {
  '1': 'يناير',
  '2': 'فبراير',
  '3': 'مارس',
  '4': 'أبريل',
  '5': 'ماي',
  '6': 'يونيو',
  '7': 'يوليوز',
  '8': 'غشت',
  '9': 'شتنبر',
  '10': 'أكتوبر',
  '11': 'نونبر',
  '12': 'دجنبر',
};

const MONTH_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-MA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-10 w-10 rounded-lg mb-3" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-52 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-60 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

interface DashboardViewProps {
  onNavigate: (view: ViewType) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error('فشل في تحميل البيانات');
        const json = await res.json();
        setData(json);
      } catch {
        toast.error('فشل في تحميل لوحة التحكم');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  // Compute chart data
  const chartData = MONTH_KEYS.map((key) => ({
    month: ARABIC_MONTHS[key],
    monthKey: key,
    revenue: data.monthlyStats[key]?.revenue || 0,
    expected: data.monthlyStats[key]?.expected || 0,
  }));
  const maxChartValue = Math.max(...chartData.map((d) => Math.max(d.revenue, d.expected)), 1);

  // Quick Actions
  const quickActions = [
    {
      label: 'تسجيل تلميذ',
      icon: UserPlus,
      view: 'students' as ViewType,
      color: 'bg-teal-500 hover:bg-teal-600',
    },
    {
      label: 'إضافة قسط',
      icon: Receipt,
      view: 'payments' as ViewType,
      color: 'bg-emerald-500 hover:bg-emerald-600',
    },
    {
      label: 'جدول الحصص',
      icon: CalendarDays,
      view: 'schedule' as ViewType,
      color: 'bg-amber-500 hover:bg-amber-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ========== Top Stats Cards ========== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <Card className="overflow-hidden border-r-4 border-r-teal-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-teal-100">
                <Users className="h-5 w-5 text-teal-600" />
              </div>
              <div className="flex items-center gap-1 text-teal-600 text-xs font-medium">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{data.activeStudents} نشط</span>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">إجمالي التلاميذ</p>
              <p className="text-2xl font-bold mt-1">{data.totalStudents}</p>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Income */}
        <Card className="overflow-hidden border-r-4 border-r-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-emerald-100">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-xs">
                {ARABIC_MONTHS[String(data.currentMonth)]}
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">المداخيل الشهرية</p>
              <p className="text-2xl font-bold mt-1">
                {data.monthlyIncome.toLocaleString()}{' '}
                <span className="text-sm font-normal text-muted-foreground">درهم</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Income This Year */}
        <Card className="overflow-hidden border-r-4 border-r-amber-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-amber-100">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{data.currentYear}</span>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">المداخيل الإجمالية</p>
              <p className="text-2xl font-bold mt-1">
                {data.totalRevenue.toLocaleString()}{' '}
                <span className="text-sm font-normal text-muted-foreground">درهم</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Teacher Payments This Year */}
        <Card className="overflow-hidden border-r-4 border-r-rose-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-rose-100">
                <GraduationCap className="h-5 w-5 text-rose-600" />
              </div>
              <div className="flex items-center gap-1 text-rose-600 text-xs font-medium">
                <TrendingDown className="h-3.5 w-3.5" />
                <span>{data.currentYear}</span>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">المصروفات</p>
              <p className="text-2xl font-bold mt-1">
                {data.teacherPaymentsThisYear.toLocaleString()}{' '}
                <span className="text-sm font-normal text-muted-foreground">درهم</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== Chart + New Registrations Row ========== */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Monthly Income Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-600" />
                <CardTitle className="text-base">المداخيل الشهرية</CardTitle>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-teal-500" />
                  <span className="text-muted-foreground">المحصل</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-amber-400/60" />
                  <span className="text-muted-foreground">المتوقع</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-52">
              {chartData.map((item) => {
                const revenueH = maxChartValue > 0 ? (item.revenue / maxChartValue) * 100 : 0;
                const expectedH = maxChartValue > 0 ? (item.expected / maxChartValue) * 100 : 0;
                const isCurrentMonth = item.monthKey === String(data.currentMonth);
                return (
                  <div
                    key={item.monthKey}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    {/* Values on hover area */}
                    {item.revenue > 0 && (
                      <span className="text-[10px] text-teal-600 font-medium opacity-80">
                        {(item.revenue / 1000).toFixed(1)}k
                      </span>
                    )}
                    <div className="w-full flex gap-0.5 items-end" style={{ height: '160px' }}>
                      {/* Expected bar (behind) */}
                      <div
                        className="flex-1 bg-amber-400/40 rounded-t-sm transition-all duration-500 min-h-[2px]"
                        style={{ height: `${Math.max(expectedH, 2)}%` }}
                      />
                      {/* Revenue bar (front) */}
                      <div
                        className={cn(
                          'flex-1 rounded-t-sm transition-all duration-500 min-h-[2px]',
                          isCurrentMonth
                            ? 'bg-gradient-to-t from-teal-600 to-teal-400'
                            : 'bg-gradient-to-t from-teal-500 to-teal-300'
                        )}
                        style={{ height: `${Math.max(revenueH, 2)}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-medium mt-1',
                        isCurrentMonth
                          ? 'text-teal-700'
                          : 'text-muted-foreground'
                      )}
                    >
                      {item.month.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* New Registrations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base">تسجيلات جديدة</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => onNavigate('students')}
              >
                عرض الكل
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">لا توجد تسجيلات جديدة</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {data.recentStudents.map((student) => (
                  <div
                    key={student.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => onNavigate('students')}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                        {student.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{student.fullName}</p>
                        {student.level && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {student.level.subject?.nameAr} — {student.level.nameAr}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          {student.phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span dir="ltr">{student.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(student.enrollmentDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ========== Recent Payments ========== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">آخر المدفوعات</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => onNavigate('payments')}
            >
              عرض الكل
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد مدفوعات بعد</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التلميذ</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">المستوى</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right hidden md:table-cell">التاريخ</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{payment.student.fullName}</p>
                          {payment.student.teacher && (
                            <p className="text-xs text-muted-foreground">
                              {payment.student.teacher.fullName}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {payment.student.level && (
                          <span className="text-xs text-muted-foreground">
                            {payment.student.level.subject?.nameAr} — {payment.student.level.nameAr}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-sm">
                            {payment.paidAmount.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-muted-foreground">درهم</span>
                          </p>
                          {payment.status === 'partial' && (
                            <p className="text-xs text-amber-600">
                              من {payment.amount.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(payment.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========== Quick Actions ========== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">إجراءات سريعة</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.view}
                onClick={() => onNavigate(action.view)}
                className={cn(
                  'text-white gap-2 h-auto py-4 flex-col rounded-xl transition-all duration-200 shadow-sm hover:shadow-md',
                  action.color
                )}
              >
                <action.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
