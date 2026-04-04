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
  GraduationCap,
  Wallet,
  AlertCircle,
  CalendarDays,
  Receipt,
  BookOpen,
  DoorOpen,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface DashboardData {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  activeTeachers: number;
  totalClassrooms: number;
  totalPayments: number;
  paidPayments: number;
  pendingPayments: number;
  totalRevenue: number;
  totalExpected: number;
  totalRemaining: number;
  recentPayments: {
    id: string;
    student: { fullName: string };
    amount: number;
    paidAmount: number;
    month: string;
    year: number;
    status: string;
  }[];
  monthlyStats: Record<string, unknown>;
}

const MONTH_NAMES: Record<string, string> = {
  January: 'يناير',
  February: 'فبراير',
  March: 'مارس',
  April: 'أبريل',
  May: 'ماي',
  June: 'يونيو',
  July: 'يوليوز',
  August: 'غشت',
  September: 'شتنبر',
  October: 'أكتوبر',
  November: 'نونبر',
  December: 'دجنبر',
};

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

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-10 w-10 rounded-lg mb-3" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
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
      } catch (err) {
        toast.error('فشل في تحميل لوحة التحكم');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const statsCards = [
    {
      title: 'إجمالي التلاميذ',
      value: data.totalStudents,
      sub: `${data.activeStudents} نشط`,
      icon: Users,
      color: 'bg-teal-50 text-teal-600',
      iconBg: 'bg-teal-100',
      trend: data.activeStudents > 0 ? 'up' : null,
    },
    {
      title: 'الأساتذة النشطين',
      value: data.activeTeachers,
      sub: `من ${data.totalTeachers} أساتذة`,
      icon: GraduationCap,
      color: 'bg-amber-50 text-amber-600',
      iconBg: 'bg-amber-100',
      trend: data.activeTeachers > 0 ? 'up' : null,
    },
    {
      title: 'المداخيل',
      value: `${data.totalRevenue.toLocaleString()} درهم`,
      sub: `من ${data.totalExpected.toLocaleString()} درهم متوقع`,
      icon: Wallet,
      color: 'bg-emerald-50 text-emerald-600',
      iconBg: 'bg-emerald-100',
      trend: data.totalRevenue > 0 ? 'up' : null,
    },
    {
      title: 'الأقساط المتبقية',
      value: `${data.totalRemaining.toLocaleString()} درهم`,
      sub: `${data.pendingPayments} قسط غير مدفوع`,
      icon: AlertCircle,
      color: 'bg-red-50 text-red-600',
      iconBg: 'bg-red-100',
      trend: data.totalRemaining > 0 ? 'down' : null,
    },
  ];

  const quickActions = [
    { label: 'التلاميذ', icon: Users, view: 'students' as ViewType, color: 'bg-teal-500 hover:bg-teal-600' },
    { label: 'الأساتذة', icon: GraduationCap, view: 'teachers' as ViewType, color: 'bg-amber-500 hover:bg-amber-600' },
    { label: 'الأقساط', icon: Receipt, view: 'payments' as ViewType, color: 'bg-emerald-500 hover:bg-emerald-600' },
    { label: 'جدول الحصص', icon: CalendarDays, view: 'schedule' as ViewType, color: 'bg-blue-500 hover:bg-blue-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <Card key={card.title} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className={cn('p-2.5 rounded-lg', card.iconBg)}>
                  <card.icon className="h-5 w-5" />
                </div>
                {card.trend === 'up' && (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                )}
                {card.trend === 'down' && (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-xl font-bold mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إجراءات سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.view}
                onClick={() => onNavigate(action.view)}
                className={cn('text-white gap-2 h-auto py-4 flex-col', action.color)}
              >
                <action.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">آخر المدفوعات</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm"
              onClick={() => onNavigate('payments')}
            >
              عرض الكل
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">لا توجد مدفوعات بعد</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التلميذ</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الشهر / السنة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium text-right">
                      {payment.student.fullName}
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.amount.toLocaleString()} درهم
                    </TableCell>
                    <TableCell className="text-right">
                      {MONTH_NAMES[payment.month] || payment.month} {payment.year}
                    </TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(payment.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
