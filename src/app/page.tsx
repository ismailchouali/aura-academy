'use client';

import { useAppStore, ViewType } from '@/store/store';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Receipt,
  Wallet,
  CalendarDays,
  BookOpen,
  DoorOpen,
  Settings,
  Menu,
  X,
  ChevronLeft,
  Phone,
  MapPin,
} from 'lucide-react';
import { DashboardView } from '@/components/views/dashboard-view';
import { StudentsView } from '@/components/views/students-view';
import { TeachersView } from '@/components/views/teachers-view';
import { PaymentsView } from '@/components/views/payments-view';
import { TeacherPaymentsView } from '@/components/views/teacher-payments-view';
import { ScheduleView } from '@/components/views/schedule-view';
import { ServicesView } from '@/components/views/services-view';
import { ClassroomsView } from '@/components/views/classrooms-view';
import { SettingsView } from '@/components/views/settings-view';

const navItems: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'students', label: 'التلاميذ', icon: <Users className="h-5 w-5" /> },
  { id: 'teachers', label: 'الأساتذة', icon: <GraduationCap className="h-5 w-5" /> },
  { id: 'payments', label: 'أقساط التلاميذ', icon: <Receipt className="h-5 w-5" /> },
  { id: 'teacher-payments', label: 'مداخيل الأساتذة', icon: <Wallet className="h-5 w-5" /> },
  { id: 'schedule', label: 'جدول الحصص', icon: <CalendarDays className="h-5 w-5" /> },
  { id: 'services', label: 'الخدمات', icon: <BookOpen className="h-5 w-5" /> },
  { id: 'classrooms', label: 'القاعات', icon: <DoorOpen className="h-5 w-5" /> },
  { id: 'settings', label: 'الإعدادات', icon: <Settings className="h-5 w-5" /> },
];

function SidebarContent({ currentView, onNavigate, onMobileClose }: { currentView: ViewType; onNavigate: (v: ViewType) => void; onMobileClose?: () => void }) {
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
            <p className="text-xs text-sidebar-foreground/70">نظام إدارة المركز</p>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3 px-2">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => {
                onNavigate(item.id);
                onMobileClose?.();
              }}
              className={cn(
                'w-full justify-start gap-3 h-11 px-3 font-medium transition-all duration-200',
                currentView === item.id
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md hover:bg-sidebar-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
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

export default function Home() {
  const { currentView, setCurrentView } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView onNavigate={setCurrentView} />;
      case 'students': return <StudentsView />;
      case 'teachers': return <TeachersView />;
      case 'payments': return <PaymentsView />;
      case 'teacher-payments': return <TeacherPaymentsView />;
      case 'schedule': return <ScheduleView />;
      case 'services': return <ServicesView />;
      case 'classrooms': return <ClassroomsView />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-main">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 shadow-xl">
        <SidebarContent currentView={currentView} onNavigate={setCurrentView} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar (Mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b sticky top-0 z-40">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <SheetTitle className="sr-only">القائمة الجانبية</SheetTitle>
              <SidebarContent
                currentView={currentView}
                onNavigate={setCurrentView}
                onMobileClose={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">A</div>
            <h1 className="font-bold text-primary">Aura Academy</h1>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3 bg-white border-b">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {navItems.find((n) => n.id === currentView)?.label || 'لوحة التحكم'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {currentView === 'dashboard' ? 'نظرة عامة على المركز' : `إدارة ${navItems.find((n) => n.id === currentView)?.label || ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              م
            </div>
            <span className="text-sm font-medium text-foreground">المدير</span>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            {renderView()}
          </div>
        </div>
      </main>
    </div>
  );
}
