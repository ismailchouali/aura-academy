'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useT } from '@/hooks/use-translation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Lock,
  Unlock,
  Wallet,
  DollarSign,
  TrendingUp,
  TrendingDown,
  GraduationCap,
  Eye,
  EyeOff,
  LogOut,
  Filter,
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
  teacherPaymentsThisYear: number;
  monthlyTeacherPayments: Record<string, number>;
}

const CORRECT_PASSWORD = 'Aura@07';

const MONTH_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
];

function FinancialContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-10 w-10 rounded-lg mb-3" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-52 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

interface PasswordScreenProps {
  onUnlock: () => void;
}

function PasswordScreen({ onUnlock }: PasswordScreenProps) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isWrong, setIsWrong] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setIsWrong(false);
      localStorage.setItem('fr_unlocked', 'true');
      onUnlock();
    } else {
      setIsWrong(true);
      toast.error(t.financialReports.wrongPassword);
      setPassword('');
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-sm mx-auto shadow-xl border-2">
        <CardContent className="p-8 text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center">
            <Lock className="h-10 w-10 text-rose-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold">{t.financialReports.passwordTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.financialReports.passwordDesc}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setIsWrong(false);
                }}
                placeholder={t.financialReports.passwordHint}
                className={cn(
                  'h-12 text-center text-lg tracking-wider',
                  isWrong && 'border-red-400 focus-visible:ring-red-400'
                )}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button type="submit" className="w-full h-12 text-base gap-2">
              <Unlock className="h-4 w-4" />
              {t.financialReports.unlock}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface FinancialContentProps {
  onLock: () => void;
}

function FinancialContent({ onLock }: FinancialContentProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useT();

  // Filter state
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<number>(0); // 0 means "use current year"

  const monthLabels: Record<string, string> = {
    '1': t.months.January,
    '2': t.months.February,
    '3': t.months.March,
    '4': t.months.April,
    '5': t.months.May,
    '6': t.months.June,
    '7': t.months.July,
    '8': t.months.August,
    '9': t.months.September,
    '10': t.months.October,
    '11': t.months.November,
    '12': t.months.December,
  };

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error();
        const json = await res.json();
        setData(json);
        setFilterYear(json.currentYear);
      } catch {
        toast.error(t.common.fetchError);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  function handleLogout() {
    localStorage.removeItem('fr_unlocked');
    onLock();
  }

  if (loading) return <FinancialContentSkeleton />;
  if (!data) return null;

  // ─── Computed values based on filter ────────────────────────────────────
  const isAllMonths = filterMonth === 'all';

  // Revenue for selected month or total for year
  const filteredRevenue = isAllMonths
    ? Object.values(data.monthlyStats).reduce((sum, m) => sum + m.revenue, 0)
    : (data.monthlyStats[filterMonth]?.revenue || 0);

  // Expenses (teacher payments) for selected month or total for year
  const filteredExpenses = isAllMonths
    ? data.teacherPaymentsThisYear
    : (data.monthlyTeacherPayments?.[filterMonth] || 0);

  // Net profit
  const netProfit = filteredRevenue - filteredExpenses;

  // Filter label
  const filterLabel = isAllMonths
    ? `مجموع ${filterYear}`
    : `${MONTH_NAMES_AR[parseInt(filterMonth) - 1]} ${filterYear}`;

  // Chart data
  const chartData = MONTH_KEYS.map((key) => ({
    month: monthLabels[key],
    monthKey: key,
    revenue: data.monthlyStats[key]?.revenue || 0,
    expected: data.monthlyStats[key]?.expected || 0,
    expenses: data.monthlyTeacherPayments?.[key] || 0,
  }));

  // Max value for chart scaling (include expenses too)
  const maxChartValue = Math.max(
    ...chartData.map((d) => Math.max(d.revenue, d.expected, d.expenses)),
    1
  );

  return (
    <div className="space-y-6">
      {/* Header with logout button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-teal-600" />
          <h2 className="text-2xl font-bold text-foreground">{t.financialReports.passwordTitle}</h2>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>

      {/* ─── Filter Bar ────────────────────────────────────────────────── */}
      <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">تصفية:</span>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأشهر</SelectItem>
                {MONTH_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {MONTH_NAMES_AR[parseInt(key) - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value) || new Date().getFullYear())}
              dir="ltr"
              className="w-24 h-8 text-xs"
            />
            <Badge variant="secondary" className="text-xs gap-1">
              {filterLabel}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ─── Stats Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Filtered Revenue (Income) */}
        <Card className="overflow-hidden border-r-4 border-r-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-emerald-100">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[10px]">
                {isAllMonths ? 'الإجمالي' : MONTH_NAMES_AR[parseInt(filterMonth) - 1]}
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">الإيرادات</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700">
                {filteredRevenue.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t.common.currency}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Filtered Expenses */}
        <Card className="overflow-hidden border-r-4 border-r-rose-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-rose-100">
                <GraduationCap className="h-5 w-5 text-rose-600" />
              </div>
              <Badge variant="outline" className="text-rose-600 border-rose-200 text-[10px]">
                {isAllMonths ? 'الإجمالي' : MONTH_NAMES_AR[parseInt(filterMonth) - 1]}
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">المصروفات</p>
              <p className="text-2xl font-bold mt-1 text-rose-700">
                {filteredExpenses.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t.common.currency}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="overflow-hidden border-r-4 border-r-amber-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-amber-100">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px]',
                  netProfit >= 0
                    ? 'text-amber-600 border-amber-200'
                    : 'text-red-600 border-red-200'
                )}
              >
                {netProfit >= 0 ? 'ربح' : 'خسارة'}
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">صافي الربح</p>
              <p className={cn('text-2xl font-bold mt-1', netProfit >= 0 ? 'text-amber-700' : 'text-red-600')}>
                {netProfit.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t.common.currency}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Current Month Income (always shows current month) */}
        <Card className="overflow-hidden border-r-4 border-r-teal-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-teal-100">
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
              <Badge variant="outline" className="text-teal-600 border-teal-200 text-[10px]">
                {MONTH_NAMES_AR[data.currentMonth - 1]}
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">هذا الشهر</p>
              <p className="text-2xl font-bold mt-1 text-teal-700">
                {data.monthlyIncome.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t.common.currency}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Monthly Income / Expenses Chart ───────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              <CardTitle className="text-base">{t.financialReports.monthlyChart}</CardTitle>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-teal-500" />
                <span className="text-muted-foreground">الإيرادات</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-amber-400/60" />
                <span className="text-muted-foreground">المتوقع</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-rose-400" />
                <span className="text-muted-foreground">المصروفات</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-56">
            {chartData.map((item) => {
              const revenueH = maxChartValue > 0 ? (item.revenue / maxChartValue) * 100 : 0;
              const expectedH = maxChartValue > 0 ? (item.expected / maxChartValue) * 100 : 0;
              const expensesH = maxChartValue > 0 ? (item.expenses / maxChartValue) * 100 : 0;
              const isCurrentMonth = item.monthKey === String(data.currentMonth);
              const isSelectedMonth = !isAllMonths && item.monthKey === filterMonth;
              const highlightMonth = isCurrentMonth || isSelectedMonth;

              return (
                <div key={item.monthKey} className="flex-1 flex flex-col items-center gap-1">
                  {item.revenue > 0 && (
                    <span className="text-[9px] text-teal-600 font-medium opacity-80">
                      {(item.revenue / 1000).toFixed(1)}k
                    </span>
                  )}
                  {item.expenses > 0 && (
                    <span className="text-[9px] text-rose-500 font-medium opacity-80">
                      {(item.expenses / 1000).toFixed(1)}k
                    </span>
                  )}
                  <div className="w-full flex gap-0.5 items-end" style={{ height: '160px' }}>
                    <div
                      className="flex-1 bg-amber-400/40 rounded-t-sm transition-all duration-500 min-h-[2px]"
                      style={{ height: `${Math.max(expectedH, 2)}%` }}
                    />
                    <div
                      className={cn(
                        'flex-1 rounded-t-sm transition-all duration-500 min-h-[2px]',
                        highlightMonth
                          ? 'bg-gradient-to-t from-teal-600 to-teal-400'
                          : 'bg-gradient-to-t from-teal-500 to-teal-300'
                      )}
                      style={{ height: `${Math.max(revenueH, 2)}%` }}
                    />
                    <div
                      className="flex-1 bg-rose-400/70 rounded-t-sm transition-all duration-500 min-h-[2px]"
                      style={{ height: `${Math.max(expensesH, 2)}%` }}
                    />
                  </div>
                  <span className={cn(
                    'text-[8px] font-medium mt-1 leading-tight',
                    highlightMonth ? 'text-teal-700' : 'text-muted-foreground'
                  )}>
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function FinancialReportsView() {
  const [isUnlocked, setIsUnlocked] = useState(() => localStorage.getItem('fr_unlocked') === 'true');

  function handleLock() {
    setIsUnlocked(false);
  }

  function handleUnlock() {
    setIsUnlocked(true);
  }

  if (!isUnlocked) {
    return <PasswordScreen onUnlock={handleUnlock} />;
  }

  return <FinancialContent onLock={handleLock} />;
}
