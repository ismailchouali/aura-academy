'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useT } from '@/hooks/use-translation';
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
  UserPlus,
  Receipt,
  CalendarDays,
  TrendingUp,
  ArrowLeft,
  Phone,
  Calendar,
  BookOpen,
  Clock,
  MapPin,
  User,
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
  todaySessions: {
    id: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    group?: string;
    sessionType: string;
    subject: {
      nameAr: string;
      service?: { nameAr: string; id: string };
    };
    teacher?: { fullName: string };
    classroom?: { name: string };
    level?: { nameAr: string };
  }[];
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-10 w-10 rounded-lg mb-3" />
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-7 w-20" />
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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-60 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
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
  const t = useT();

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error();
        const json = await res.json();
        setData(json);
      } catch {
        toast.error(t.dashboard.fetchError);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  // Compute today's day key for schedule: JS getDay() 0=Sun..6=Sat → Schedule "1"=Sun, "2"=Mon..etc
  const todayJsDay = new Date().getDay();
  const todayDayKey = todayJsDay === 0 ? '1' : String(todayJsDay + 1);

  function getServiceColors(serviceName: string) {
    const lower = serviceName.toLowerCase();
    if (lower.includes('soutien')) {
      return { cardBg: 'bg-teal-50 border-teal-200', text: 'text-teal-700' };
    }
    if (lower.includes('langue')) {
      return { cardBg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' };
    }
    if (lower.includes('informatique') || lower.includes('it')) {
      return { cardBg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' };
    }
    if (lower.includes('concours') || lower.includes('prépa')) {
      return { cardBg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' };
    }
    return { cardBg: 'bg-gray-50 border-gray-200', text: 'text-gray-700' };
  }

  const quickActions = [
    {
      label: t.dashboard.registerStudent,
      icon: UserPlus,
      view: 'students' as ViewType,
      color: 'bg-teal-500 hover:bg-teal-600',
    },
    {
      label: t.dashboard.addPayment,
      icon: Receipt,
      view: 'payments' as ViewType,
      color: 'bg-emerald-500 hover:bg-emerald-600',
    },
    {
      label: t.dashboard.viewSchedule,
      icon: CalendarDays,
      view: 'schedule' as ViewType,
      color: 'bg-amber-500 hover:bg-amber-600',
    },
  ];

  function statusBadge(status: string) {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">{t.payments.statusPaid}</Badge>;
      case 'partial':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">{t.payments.statusPartial}</Badge>;
      case 'pending':
        return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">{t.payments.statusPending}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function fmtDate(dateStr: string) {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return (
    <div className="space-y-6">
      {/* Students Stats Card */}
      <Card className="overflow-hidden border-r-4 border-r-teal-500">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-lg bg-teal-100">
              <Users className="h-5 w-5 text-teal-600" />
            </div>
            <div className="flex items-center gap-1 text-teal-600 text-xs font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{data.activeStudents} {t.common.active}</span>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">{t.dashboard.totalStudents}</p>
            <p className="text-2xl font-bold mt-1">{data.totalStudents}</p>
          </div>
        </CardContent>
      </Card>

      {/* Today's Sessions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-teal-600" />
              <CardTitle className="text-base">{t.dashboard.todaySessions}</CardTitle>
              <Badge variant="outline" className="text-xs font-normal">{t.days[todayDayKey]}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => onNavigate('schedule')}>
              {t.common.viewAll}
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.todaySessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t.dashboard.noSessionsToday}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data.todaySessions.map((session) => {
                const serviceName = session.subject.service?.nameAr || '';
                const colors = getServiceColors(serviceName);
                return (
                  <div
                    key={session.id}
                    className={cn(
                      'p-3 rounded-lg border transition-colors',
                      session.sessionType === 'trial'
                        ? 'border-dashed bg-opacity-50'
                        : 'border-solid',
                      colors.cardBg
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Time */}
                      <div className="shrink-0 text-center min-w-[52px]">
                        <div className="flex items-center justify-center gap-1 text-xs font-bold text-foreground">
                          <Clock className="h-3 w-3" />
                          <span dir="ltr">{session.startTime}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">
                          — {session.endTime}
                        </div>
                      </div>

                      {/* Session Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('font-semibold text-sm', colors.text)}>
                            {session.subject.nameAr}
                          </span>
                          {session.level && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {session.level.nameAr}
                            </Badge>
                          )}
                          {session.sessionType === 'trial' && (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] px-1.5 py-0">
                              تجريبية
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {session.teacher && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {session.teacher.fullName}
                            </span>
                          )}
                          {session.classroom && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {session.classroom.name}
                            </span>
                          )}
                          {session.group && (
                            <span className="text-xs text-muted-foreground">
                              🏷️ {session.group}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Registrations */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">{t.dashboard.newRegistrations}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => onNavigate('students')}>
              {t.common.viewAll}
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t.dashboard.noRegistrations}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recentStudents.map((student) => (
                <div key={student.id} className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => onNavigate('students')}>
                  <div className="flex items-start gap-3">
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
                      {student.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          <span dir="ltr">{student.phone}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-left shrink-0">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {fmtDate(student.enrollmentDate)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">{t.dashboard.recentPayments}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => onNavigate('payments')}>
              {t.common.viewAll}
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t.dashboard.noPayments}</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{t.dashboard.studentCol}</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">{t.dashboard.levelCol}</TableHead>
                    <TableHead className="text-right">{t.dashboard.amountCol}</TableHead>
                    <TableHead className="text-right hidden md:table-cell">{t.dashboard.dateCol}</TableHead>
                    <TableHead className="text-right">{t.common.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{payment.student.fullName}</p>
                          {payment.student.teacher && (
                            <p className="text-xs text-muted-foreground">{payment.student.teacher.fullName}</p>
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
                            {payment.paidAmount.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{t.common.currency}</span>
                          </p>
                          {payment.status === 'partial' && (
                            <p className="text-xs text-amber-600">{t.dashboard.from} {payment.amount.toLocaleString()}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">{fmtDate(payment.createdAt)}</span>
                      </TableCell>
                      <TableCell>{statusBadge(payment.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">{t.dashboard.quickActions}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.view}
                onClick={() => onNavigate(action.view)}
                className={cn('text-white gap-2 h-auto py-4 flex-col rounded-xl transition-all duration-200 shadow-sm hover:shadow-md', action.color)}
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
