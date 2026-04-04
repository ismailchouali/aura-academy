'use client';

import { useEffect, useState } from 'react';
import {
  GraduationCap,
  Languages,
  Monitor,
  Trophy,
  BookOpen,
  Layers,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Level {
  id: string;
  name: string;
  nameAr: string;
  nameFr: string;
}

interface Subject {
  id: string;
  name: string;
  nameAr: string;
  nameFr: string;
  levels: Level[];
}

interface Service {
  id: string;
  name: string;
  nameAr: string;
  nameFr: string;
  icon: string;
  subjects: Subject[];
}

const SERVICE_CONFIGS: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; badge: string }> = {
  'دروس الدعم': {
    icon: GraduationCap,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  'اللغات': {
    icon: Languages,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
  },
  'تكنولوجيا المعلومات': {
    icon: Monitor,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  'تحضير المسابقات': {
    icon: Trophy,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
  },
};

const DEFAULT_CONFIG = {
  icon: BookOpen,
  color: 'text-slate-600',
  bg: 'bg-slate-50',
  border: 'border-slate-200',
  badge: 'bg-slate-100 text-slate-700',
};

const DAY_MAP: Record<string, string> = {
  '1': 'الأحد',
  '2': 'الاثنين',
  '3': 'الثلاثاء',
  '4': 'الأربعاء',
  '5': 'الخميس',
  '6': 'الجمعة',
  '7': 'السبت',
};

function StatsCards({ services, subjects, levels }: { services: number; subjects: number; levels: number }) {
  const stats = [
    { label: 'الخدمات', value: services, icon: Layers, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'المواد', value: subjects, icon: BookOpen, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'المستويات', value: levels, icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={cn('flex items-center justify-center w-12 h-12 rounded-xl', stat.bg)}>
              <stat.icon className={cn('w-6 h-6', stat.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-3 py-2">
                <Skeleton className="w-2 h-2 rounded-full" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Layers className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">لا توجد خدمات حالياً</h3>
        <p className="text-muted-foreground text-center max-w-sm">
          لم يتم إضافة أي خدمات بعد. يرجى التواصل مع المدير لإضافة الخدمات.
        </p>
      </CardContent>
    </Card>
  );
}

export function ServicesView() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch('/api/services');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setServices(data);
      } catch {
        toast.error('فشل في تحميل الخدمات');
      } finally {
        setLoading(false);
      }
    }
    fetchServices();
  }, []);

  const totalSubjects = services.reduce((acc, s) => acc + s.subjects.length, 0);
  const totalLevels = services.reduce(
    (acc, s) => acc + s.subjects.reduce((a, sub) => a + sub.levels.length, 0),
    0
  );

  if (loading) return <LoadingSkeleton />;

  if (services.length === 0) return <EmptyState />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">دليل الخدمات</h2>
          <p className="text-sm text-muted-foreground">استعرض جميع الخدمات والمواد الدراسية المتوفرة</p>
        </div>
      </div>

      {/* Stats */}
      <StatsCards services={services.length} subjects={totalSubjects} levels={totalLevels} />

      {/* Services Accordion */}
      <Accordion type="multiple" className="space-y-3">
        {services.map((service) => {
          const config = SERVICE_CONFIGS[service.nameAr] || DEFAULT_CONFIG;
          const Icon = config.icon;

          return (
            <AccordionItem
              key={service.id}
              value={service.id}
              className={cn(
                'rounded-xl border-2 transition-all',
                config.border,
                'bg-white shadow-sm',
                'data-[state=open]:shadow-md'
              )}
            >
              <AccordionTrigger className="px-6 py-5 hover:no-underline hover:bg-white/50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.bg)}>
                    <Icon className={cn('w-6 h-6', config.color)} />
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-bold">{service.nameAr}</h3>
                    <p className="text-sm text-muted-foreground">{service.nameFr}</p>
                  </div>
                  <Badge variant="secondary" className="mr-auto text-xs">
                    {service.subjects.length} {service.subjects.length === 1 ? 'مادة' : 'مواد'}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-5">
                {service.subjects.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">لا توجد مواد في هذه الخدمة</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {service.subjects.map((subject) => (
                      <div
                        key={subject.id}
                        className={cn(
                          'rounded-lg border p-4 transition-colors hover:shadow-sm',
                          config.bg,
                          config.border
                        )}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <ChevronLeft className={cn('w-4 h-4', config.color)} />
                          <h4 className="font-semibold">{subject.nameAr}</h4>
                          <span className="text-xs text-muted-foreground">({subject.nameFr})</span>
                        </div>
                        {subject.levels.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {subject.levels.map((level) => (
                              <Badge
                                key={level.id}
                                variant="secondary"
                                className={cn('text-xs', config.badge)}
                              >
                                {level.nameAr}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {subject.levels.length === 0 && (
                          <p className="text-xs text-muted-foreground">لا توجد مستويات</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
