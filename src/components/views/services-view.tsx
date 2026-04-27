'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap,
  Languages,
  Monitor,
  Trophy,
  BookOpen,
  Layers,
  ChevronLeft,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

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

export function ServicesView() {
  const t = useT();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Add Service dialog ──────────────────────────────────────
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', nameAr: '', nameFr: '', icon: '' });
  const [serviceSubmitting, setServiceSubmitting] = useState(false);

  // ── Add Subject dialog ──────────────────────────────────────
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [subjectServiceId, setSubjectServiceId] = useState('');
  const [subjectForm, setSubjectForm] = useState({ name: '', nameAr: '', nameFr: '' });
  const [subjectSubmitting, setSubjectSubmitting] = useState(false);

  // ── Add Level dialog ────────────────────────────────────────
  const [addLevelOpen, setAddLevelOpen] = useState(false);
  const [levelServiceId, setLevelServiceId] = useState('');
  const [levelSubjectId, setLevelSubjectId] = useState('');
  const [levelForm, setLevelForm] = useState({ name: '', nameAr: '', nameFr: '' });
  const [levelSubmitting, setLevelSubmitting] = useState(false);

  // ── Edit Subject dialog ─────────────────────────────────────
  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [editSubjectServiceId, setEditSubjectServiceId] = useState('');
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editSubjectForm, setEditSubjectForm] = useState({ name: '', nameAr: '', nameFr: '' });
  const [editSubjectSubmitting, setEditSubjectSubmitting] = useState(false);

  // ── Delete Subject confirmation ─────────────────────────────
  const [deleteSubjectOpen, setDeleteSubjectOpen] = useState(false);
  const [deleteSubjectServiceId, setDeleteSubjectServiceId] = useState('');
  const [deleteSubjectId, setDeleteSubjectId] = useState('');
  const [deleteSubjectName, setDeleteSubjectName] = useState('');
  const [deleteSubjectSubmitting, setDeleteSubjectSubmitting] = useState(false);

  // ── Edit Level dialog ───────────────────────────────────────
  const [editLevelOpen, setEditLevelOpen] = useState(false);
  const [editLevelServiceId, setEditLevelServiceId] = useState('');
  const [editLevelSubjectId, setEditLevelSubjectId] = useState('');
  const [editLevelId, setEditLevelId] = useState('');
  const [editLevelForm, setEditLevelForm] = useState({ name: '', nameAr: '', nameFr: '' });
  const [editLevelSubmitting, setEditLevelSubmitting] = useState(false);

  // ── Delete Level confirmation ───────────────────────────────
  const [deleteLevelOpen, setDeleteLevelOpen] = useState(false);
  const [deleteLevelServiceId, setDeleteLevelServiceId] = useState('');
  const [deleteLevelSubjectId, setDeleteLevelSubjectId] = useState('');
  const [deleteLevelId, setDeleteLevelId] = useState('');
  const [deleteLevelName, setDeleteLevelName] = useState('');
  const [deleteLevelSubmitting, setDeleteLevelSubmitting] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setServices(data);
    } catch {
      toast.error(t.services.fetchError);
    } finally {
      setLoading(false);
    }
  }, [t.services.fetchError]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const totalSubjects = services.reduce((acc, s) => acc + s.subjects.length, 0);
  const totalLevels = services.reduce(
    (acc, s) => acc + s.subjects.reduce((a, sub) => a + sub.levels.length, 0),
    0
  );

  // ── Handlers ────────────────────────────────────────────────

  const handleAddService = async () => {
    if (!serviceForm.name.trim() || !serviceForm.nameAr.trim() || !serviceForm.nameFr.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setServiceSubmitting(true);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceForm),
      });
      if (!res.ok) throw new Error();
      toast.success('تم إضافة الخدمة بنجاح');
      setAddServiceOpen(false);
      setServiceForm({ name: '', nameAr: '', nameFr: '', icon: '' });
      fetchServices();
    } catch {
      toast.error('فشل في إضافة الخدمة');
    } finally {
      setServiceSubmitting(false);
    }
  };

  const handleOpenAddSubject = (serviceId: string) => {
    setSubjectServiceId(serviceId);
    setSubjectForm({ name: '', nameAr: '', nameFr: '' });
    setAddSubjectOpen(true);
  };

  const handleAddSubject = async () => {
    if (!subjectForm.name.trim() || !subjectForm.nameAr.trim() || !subjectForm.nameFr.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setSubjectSubmitting(true);
    try {
      const res = await fetch(`/api/services/${subjectServiceId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subjectForm),
      });
      if (!res.ok) throw new Error();
      toast.success('تم إضافة المادة بنجاح');
      setAddSubjectOpen(false);
      fetchServices();
    } catch {
      toast.error('فشل في إضافة المادة');
    } finally {
      setSubjectSubmitting(false);
    }
  };

  const handleOpenAddLevel = (serviceId: string, subjectId: string) => {
    setLevelServiceId(serviceId);
    setLevelSubjectId(subjectId);
    setLevelForm({ name: '', nameAr: '', nameFr: '' });
    setAddLevelOpen(true);
  };

  const handleAddLevel = async () => {
    if (!levelForm.name.trim() || !levelForm.nameAr.trim() || !levelForm.nameFr.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setLevelSubmitting(true);
    try {
      const res = await fetch(`/api/services/${levelServiceId}/subjects/${levelSubjectId}/levels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(levelForm),
      });
      if (!res.ok) throw new Error();
      toast.success('تم إضافة المستوى بنجاح');
      setAddLevelOpen(false);
      fetchServices();
    } catch {
      toast.error('فشل في إضافة المستوى');
    } finally {
      setLevelSubmitting(false);
    }
  };

  // ── Edit Subject ────────────────────────────────────────────

  const handleOpenEditSubject = (serviceId: string, subject: { id: string; name: string; nameAr: string; nameFr: string }) => {
    setEditSubjectServiceId(serviceId);
    setEditSubjectId(subject.id);
    setEditSubjectForm({ name: subject.name, nameAr: subject.nameAr, nameFr: subject.nameFr });
    setEditSubjectOpen(true);
  };

  const handleEditSubject = async () => {
    if (!editSubjectForm.name.trim() || !editSubjectForm.nameAr.trim() || !editSubjectForm.nameFr.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setEditSubjectSubmitting(true);
    try {
      const res = await fetch(`/api/services/${editSubjectServiceId}/subjects/${editSubjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editSubjectForm),
      });
      if (!res.ok) throw new Error();
      toast.success('تم تعديل المادة بنجاح');
      setEditSubjectOpen(false);
      fetchServices();
    } catch {
      toast.error('فشل في تعديل المادة');
    } finally {
      setEditSubjectSubmitting(false);
    }
  };

  // ── Delete Subject ──────────────────────────────────────────

  const handleOpenDeleteSubject = (serviceId: string, subject: { id: string; nameAr: string }) => {
    setDeleteSubjectServiceId(serviceId);
    setDeleteSubjectId(subject.id);
    setDeleteSubjectName(subject.nameAr);
    setDeleteSubjectOpen(true);
  };

  const handleDeleteSubject = async () => {
    setDeleteSubjectSubmitting(true);
    try {
      const res = await fetch(`/api/services/${deleteSubjectServiceId}/subjects/${deleteSubjectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success('تم حذف المادة بنجاح');
      setDeleteSubjectOpen(false);
      fetchServices();
    } catch {
      toast.error('فشل في حذف المادة');
    } finally {
      setDeleteSubjectSubmitting(false);
    }
  };

  // ── Edit Level ──────────────────────────────────────────────

  const handleOpenEditLevel = (serviceId: string, subjectId: string, level: { id: string; name: string; nameAr: string; nameFr: string }) => {
    setEditLevelServiceId(serviceId);
    setEditLevelSubjectId(subjectId);
    setEditLevelId(level.id);
    setEditLevelForm({ name: level.name, nameAr: level.nameAr, nameFr: level.nameFr });
    setEditLevelOpen(true);
  };

  const handleEditLevel = async () => {
    if (!editLevelForm.name.trim() || !editLevelForm.nameAr.trim() || !editLevelForm.nameFr.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    setEditLevelSubmitting(true);
    try {
      const res = await fetch(`/api/services/${editLevelServiceId}/subjects/${editLevelSubjectId}/levels/${editLevelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editLevelForm),
      });
      if (!res.ok) throw new Error();
      toast.success('تم تعديل المستوى بنجاح');
      setEditLevelOpen(false);
      fetchServices();
    } catch {
      toast.error('فشل في تعديل المستوى');
    } finally {
      setEditLevelSubmitting(false);
    }
  };

  // ── Delete Level ────────────────────────────────────────────

  const handleOpenDeleteLevel = (serviceId: string, subjectId: string, level: { id: string; nameAr: string }) => {
    setDeleteLevelServiceId(serviceId);
    setDeleteLevelSubjectId(subjectId);
    setDeleteLevelId(level.id);
    setDeleteLevelName(level.nameAr);
    setDeleteLevelOpen(true);
  };

  const handleDeleteLevel = async () => {
    setDeleteLevelSubmitting(true);
    try {
      const res = await fetch(`/api/services/${deleteLevelServiceId}/subjects/${deleteLevelSubjectId}/levels/${deleteLevelId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success('تم حذف المستوى بنجاح');
      setDeleteLevelOpen(false);
      fetchServices();
    } catch {
      toast.error('فشل في حذف المستوى');
    } finally {
      setDeleteLevelSubmitting(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t.services.title}</h2>
            <p className="text-sm text-muted-foreground">{t.services.subtitle}</p>
          </div>
        </div>
        <Button onClick={() => setAddServiceOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة خدمة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t.services.servicesLabel, value: services.length, icon: Layers, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t.services.subjectsLabel, value: totalSubjects, icon: BookOpen, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: t.services.levelsLabel, value: totalLevels, icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat) => (
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
                    {service.subjects.length} {service.subjects.length === 1 ? t.services.subject : t.services.subjects}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-5">
                {/* Add Subject button */}
                <div className="flex items-center gap-2 mb-3 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs border-dashed"
                    onClick={() => handleOpenAddSubject(service.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    إضافة مادة
                  </Button>
                </div>

                {service.subjects.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">لا توجد مواد في هذه الخدمة</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                          <div className="flex items-center gap-1 mr-auto">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEditSubject(service.id, subject)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleOpenDeleteSubject(service.id, subject)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {subject.levels.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {subject.levels.map((level) => (
                              <Badge
                                key={level.id}
                                variant="secondary"
                                className={cn('text-xs gap-1', config.badge)}
                              >
                                {level.nameAr}
                                <button
                                  className="inline-flex items-center justify-center hover:text-destructive transition-colors"
                                  onClick={() => handleOpenEditLevel(service.id, subject.id, level)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  className="inline-flex items-center justify-center hover:text-destructive transition-colors"
                                  onClick={() => handleOpenDeleteLevel(service.id, subject.id, level)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        {/* Add Level button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs text-muted-foreground h-7 mt-2"
                          onClick={() => handleOpenAddLevel(service.id, subject.id)}
                        >
                          <Plus className="h-3 w-3" />
                          إضافة مستوى
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {services.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Layers className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">{t.services.noServices}</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {t.services.noServicesDesc}
            </p>
            <Button onClick={() => setAddServiceOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة خدمة جديدة
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════
          ADD SERVICE DIALOG
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>إضافة خدمة جديدة</DialogTitle>
            <DialogDescription>أدخل بيانات الخدمة الجديدة</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>الاسم (عربي) *</Label>
                <Input
                  placeholder="مثال: دروس الدعم"
                  value={serviceForm.nameAr}
                  onChange={(e) => setServiceForm({ ...serviceForm, nameAr: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم (فرنسي) *</Label>
                <Input
                  placeholder="Ex: Cours de Soutiens"
                  value={serviceForm.nameFr}
                  onChange={(e) => setServiceForm({ ...serviceForm, nameFr: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>المفتاح الداخلي (name)</Label>
                <Input
                  placeholder="مثال: Cours de Soutiens"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>الأيقونة (إيموجي)</Label>
                <Input
                  placeholder="مثال: 🎓"
                  value={serviceForm.icon}
                  onChange={(e) => setServiceForm({ ...serviceForm, icon: e.target.value })}
                  className="w-24 text-center text-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setAddServiceOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddService} disabled={serviceSubmitting} className="gap-2">
              {serviceSubmitting ? 'جاري الإضافة...' : 'إضافة الخدمة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          ADD SUBJECT DIALOG
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>إضافة مادة جديدة</DialogTitle>
            <DialogDescription>أدخل بيانات المادة الجديدة</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>الاسم (عربي) *</Label>
                <Input
                  placeholder="مثال: الرياضيات"
                  value={subjectForm.nameAr}
                  onChange={(e) => setSubjectForm({ ...subjectForm, nameAr: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم (فرنسي) *</Label>
                <Input
                  placeholder="Ex: Mathématiques"
                  value={subjectForm.nameFr}
                  onChange={(e) => setSubjectForm({ ...subjectForm, nameFr: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>المفتاح الداخلي (name)</Label>
                <Input
                  placeholder="مثال: Mathématiques"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setAddSubjectOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddSubject} disabled={subjectSubmitting} className="gap-2">
              {subjectSubmitting ? 'جاري الإضافة...' : 'إضافة المادة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          EDIT SUBJECT DIALOG
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={editSubjectOpen} onOpenChange={setEditSubjectOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>تعديل المادة</DialogTitle>
            <DialogDescription>تعديل بيانات المادة</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>الاسم (عربي) *</Label>
                <Input
                  placeholder="مثال: الرياضيات"
                  value={editSubjectForm.nameAr}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, nameAr: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم (فرنسي) *</Label>
                <Input
                  placeholder="Ex: Mathématiques"
                  value={editSubjectForm.nameFr}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, nameFr: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>المفتاح الداخلي (name)</Label>
                <Input
                  placeholder="مثال: Mathématiques"
                  value={editSubjectForm.name}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, name: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setEditSubjectOpen(false)}>إلغاء</Button>
            <Button onClick={handleEditSubject} disabled={editSubjectSubmitting} className="gap-2">
              {editSubjectSubmitting ? 'جاري التعديل...' : 'حفظ التعديلات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          DELETE SUBJECT CONFIRMATION
          ═══════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteSubjectOpen} onOpenChange={setDeleteSubjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف المادة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المادة &quot;{deleteSubjectName}&quot; وجميع المستويات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubjectSubmitting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubject}
              disabled={deleteSubjectSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubjectSubmitting ? 'جاري الحذف...' : 'حذف المادة'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════════════════════════════════════════════
          ADD LEVEL DIALOG
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={addLevelOpen} onOpenChange={setAddLevelOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>إضافة مستوى جديد</DialogTitle>
            <DialogDescription>أدخل بيانات المستوى الجديد</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>الاسم (عربي) *</Label>
                <Input
                  placeholder="مثال: السنة الأولى"
                  value={levelForm.nameAr}
                  onChange={(e) => setLevelForm({ ...levelForm, nameAr: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم (فرنسي) *</Label>
                <Input
                  placeholder="Ex: 1ère Année"
                  value={levelForm.nameFr}
                  onChange={(e) => setLevelForm({ ...levelForm, nameFr: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>المفتاح الداخلي (name)</Label>
                <Input
                  placeholder="مثال: 1ère Année"
                  value={levelForm.name}
                  onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setAddLevelOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddLevel} disabled={levelSubmitting} className="gap-2">
              {levelSubmitting ? 'جاري الإضافة...' : 'إضافة المستوى'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          EDIT LEVEL DIALOG
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={editLevelOpen} onOpenChange={setEditLevelOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>تعديل المستوى</DialogTitle>
            <DialogDescription>تعديل بيانات المستوى</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>الاسم (عربي) *</Label>
                <Input
                  placeholder="مثال: السنة الأولى"
                  value={editLevelForm.nameAr}
                  onChange={(e) => setEditLevelForm({ ...editLevelForm, nameAr: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم (فرنسي) *</Label>
                <Input
                  placeholder="Ex: 1ère Année"
                  value={editLevelForm.nameFr}
                  onChange={(e) => setEditLevelForm({ ...editLevelForm, nameFr: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>المفتاح الداخلي (name)</Label>
                <Input
                  placeholder="مثال: 1ère Année"
                  value={editLevelForm.name}
                  onChange={(e) => setEditLevelForm({ ...editLevelForm, name: e.target.value })}
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setEditLevelOpen(false)}>إلغاء</Button>
            <Button onClick={handleEditLevel} disabled={editLevelSubmitting} className="gap-2">
              {editLevelSubmitting ? 'جاري التعديل...' : 'حفظ التعديلات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          DELETE LEVEL CONFIRMATION
          ═══════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteLevelOpen} onOpenChange={setDeleteLevelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف المستوى؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المستوى &quot;{deleteLevelName}&quot;. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLevelSubmitting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLevel}
              disabled={deleteLevelSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLevelSubmitting ? 'جاري الحذف...' : 'حذف المستوى'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
