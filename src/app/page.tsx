'use client';

import { useAppStore, ViewType } from '@/store/store';
import { useState, useEffect } from 'react';
import LoginPage from '@/components/login-page';
import { cn } from '@/lib/utils';
import { useT } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  GraduationCap,
  Receipt,
  Wallet,
  CalendarDays,
  BookOpen,
  DoorOpen,
  Settings,
  Menu,
  Phone,
  MapPin,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { FinancialReportsView } from '@/components/views/financial-reports-view';
import { DashboardView } from '@/components/views/dashboard-view';
import { StudentsView } from '@/components/views/students-view';
import { TeachersView } from '@/components/views/teachers-view';
import { PaymentsView } from '@/components/views/payments-view';
import { TeacherPaymentsView } from '@/components/views/teacher-payments-view';
import { ScheduleView } from '@/components/views/schedule-view';
import { ServicesView } from '@/components/views/services-view';
import { ClassroomsView } from '@/components/views/classrooms-view';
import { SettingsView } from '@/components/views/settings-view';
import UsersView from '@/components/views/users-view';
import { ErrorBoundary } from '@/components/error-boundary';
import { LogOut } from 'lucide-react';

const navIcons: Record<ViewType, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-5 w-5" />,
  'financial-reports': <TrendingUp className="h-5 w-5" />,
  students: <Users className="h-5 w-5" />,
  teachers: <GraduationCap className="h-5 w-5" />,
  payments: <Receipt className="h-5 w-5" />,
  'teacher-payments': <Wallet className="h-5 w-5" />,
  schedule: <CalendarDays className="h-5 w-5" />,
  services: <BookOpen className="h-5 w-5" />,
  classrooms: <DoorOpen className="h-5 w-5" />,
  'user-management': <ShieldCheck className="h-5 w-5" />,
  settings: <Settings className="h-5 w-5" />,
};

const navKeys: ViewType[] = [
  'dashboard', 'user-management', 'financial-reports', 'students', 'teachers', 'payments',
  'teacher-payments', 'schedule', 'services', 'classrooms', 'settings',
];

function getNavLabel(t: ReturnType<typeof useT>, id: ViewType): string {
  const map: Record<ViewType, string> = {
    dashboard: t.nav.dashboard,
    'financial-reports': t.nav.financialReports,
    students: t.nav.students,
    teachers: t.nav.teachers,
    payments: t.nav.payments,
    'teacher-payments': t.nav.teacherPayments,
    schedule: t.nav.schedule,
    services: t.nav.services,
    classrooms: t.nav.classrooms,
    'user-management': 'إدارة المستخدمين',
    settings: t.nav.settings,
  };
  return map[id] || id;
}

function getNavDesc(t: ReturnType<typeof useT>, id: ViewType): string {
  if (id === 'dashboard') return t.nav.dashboardDesc;
  if (id === 'financial-reports') return t.nav.financialReportsDesc;
  return `${t.nav.manageDashboard.replace(t.nav.dashboard, '')} ${getNavLabel(t, id)}`;
}

function SidebarContent({ currentView, onNavigate, onMobileClose, navKeys: keys }: { currentView: ViewType; onNavigate: (v: ViewType) => void; onMobileClose?: () => void; navKeys?: ViewType[] }) {
  const t = useT();
  const items = keys || navKeys;

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-lg shadow-lg">
            A
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Aura Academy</h1>
            <p className="text-xs text-sidebar-foreground/70">{t.sidebar.systemName}</p>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3 px-2">
        <nav className="space-y-1">
          {items.map((id) => (
            <Button
              key={id}
              variant="ghost"
              onClick={() => {
                onNavigate(id);
                onMobileClose?.();
              }}
              className={cn(
                'w-full justify-start gap-3 h-11 px-3 font-medium transition-all duration-200',
                currentView === id
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md hover:bg-sidebar-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              {navIcons[id]}
              <span>{getNavLabel(t, id)}</span>
            </Button>
          ))}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Center Info */}
      <div className="p-4 space-y-2 text-xs text-sidebar-foreground/70">
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span dir="ltr">0606030356</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="line-clamp-2">بني ملال، شارع محمد الخامس، فوق مكتبة وورك بيرو</span>
        </div>
      </div>
    </div>
  );
}

function LanguageToggle() {
  const { lang, toggleLang } = useAppStore();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLang}
      className="gap-1.5 h-8 px-3 text-xs font-medium"
    >
      <Globe className="h-3.5 w-3.5" />
      {lang === 'ar' ? 'عربي' : 'Français'}
    </Button>
  );
}

export default function Home() {
  const { currentView, setCurrentView, lang } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [accessPages, setAccessPages] = useState<string>('');
  const t = useT();

  const isAdmin = userRole === 'ADMIN';

  // Filter nav items by role and accessPages
  const hiddenForSecretary = new Set<ViewType>(['user-management', 'financial-reports']);
  const filteredNavKeys = navKeys.filter(k => {
    if (isAdmin) return true; // Admin sees everything
    if (hiddenForSecretary.has(k)) return false; // Secretary can never see these
    // Check accessPages for custom permissions
    if (accessPages) {
      const pages = accessPages.split(',').map(p => p.trim());
      if (pages.length > 0 && !pages.includes(k)) return false;
    }
    return true;
  });

  // Check auth on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        setIsAuthenticated(true);
        setUserName(data.user?.fullName || 'مستخدم');
        setUserRole(data.user?.role || '');
        setAccessPages(data.user?.accessPages || '');
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView onNavigate={setCurrentView} />;
      case 'financial-reports': return <FinancialReportsView />;
      case 'students': return <StudentsView />;
      case 'teachers': return <TeachersView />;
      case 'payments': return <PaymentsView />;
      case 'teacher-payments': return <TeacherPaymentsView />;
      case 'schedule': return <ScheduleView />;
      case 'services': return <ServicesView />;
      case 'classrooms': return <ClassroomsView />;
      case 'user-management': return isAdmin ? <UsersView /> : <DashboardView onNavigate={setCurrentView} />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  // RTL/LTR direction based on language
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="flex min-h-screen bg-bg-main" dir={dir}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 shadow-xl lg:sticky lg:top-0 lg:h-screen lg:self-start">
        <SidebarContent currentView={currentView} onNavigate={setCurrentView} navKeys={filteredNavKeys} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Bar (Mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b sticky top-0 z-40">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={lang === 'ar' ? 'right' : 'left'} className="w-64 p-0">
              <SheetTitle className="sr-only">{t.sidebar.menuTitle}</SheetTitle>
              <SidebarContent
                currentView={currentView}
                onNavigate={setCurrentView}
                onMobileClose={() => setMobileOpen(false)}
                navKeys={filteredNavKeys}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">A</div>
            <h1 className="font-bold text-primary">Aura Academy</h1>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3 bg-white border-b lg:sticky lg:top-0 lg:z-30">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {getNavLabel(t, currentView)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {getNavDesc(t, currentView)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 text-muted-foreground hover:text-destructive" title="تسجيل الخروج">
              <LogOut className="h-4 w-4" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {userName.charAt(0)}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-foreground">{userName}</span>
              <span className="text-[10px] text-muted-foreground">{userRole === 'ADMIN' ? 'مدير' : 'سكرتير'}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              {renderView()}
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}
