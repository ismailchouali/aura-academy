'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useT } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Trash2,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Zap,
  CalendarCheck,
  AlertTriangle,
  Edit2,
  Printer,
  GraduationCap,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Level {
  id: string;
  name: string;
  nameAr: string;
}

interface Subject {
  id: string;
  name: string;
  nameAr: string;
  levels: Level[];
  serviceId: string;
  service?: { id: string; name: string; nameAr: string };
}

interface Service {
  id: string;
  name: string;
  nameAr: string;
  subjects: Subject[];
}

interface Teacher {
  id: string;
  fullName: string;
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

interface Classroom {
  id: string;
  name: string;
  nameAr: string;
  capacity: number;
}

interface Schedule {
  id: string;
  subjectId: string;
  subject: { name: string; nameAr: string; service?: { id: string; name: string; nameAr: string } };
  teacherId: string | null;
  teacher: { fullName: string } | null;
  classroomId: string | null;
  classroom: { name: string; nameAr: string } | null;
  levelId: string | null;
  level: { name: string; nameAr: string } | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  group: string | null;
  sessionType: string;
  isRecurring: boolean;
}

interface ScheduleFormData {
  sessionType: 'fixed' | 'trial';
  isRecurring: boolean;
  daysOfWeek: string[];
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  classroomId: string;
  subjectId: string;
  teacherId: string;
  levelId: string;
  group: string;
}

interface ConflictError {
  type: 'classroom' | 'teacher';
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Days array - populated inside component with translations
function getDays(t: ReturnType<typeof useT>) {
  return [
    { value: '1', label: t.days['1'], short: t.days.short['1'] },
    { value: '2', label: t.days['2'], short: t.days.short['2'] },
    { value: '3', label: t.days['3'], short: t.days.short['3'] },
    { value: '4', label: t.days['4'], short: t.days.short['4'] },
    { value: '5', label: t.days['5'], short: t.days.short['5'] },
    { value: '6', label: t.days['6'], short: t.days.short['6'] },
    { value: '7', label: t.days['7'], short: t.days.short['7'] },
  ];
}

const SLOT_HEIGHT = 48;
const FIRST_SLOT_MINUTES = 11 * 60; // 11:00 = 660 min
const DAY_COLUMN_WIDTH = 160;
const TIME_COLUMN_WIDTH = 70;

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 11; h <= 22; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 22) {
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
  }
  slots.push('22:30');
  return slots;
}

const timeSlots = generateTimeSlots();

// Service-based color mapping (per task spec)
const serviceColorMap: Record<string, { fixed: string; trial: string; badge: string; badgeTrial: string }> = {
  'Cours de Soutiens': {
    fixed: 'bg-teal-100 text-teal-800 border-teal-300 border-solid',
    trial: 'bg-teal-50 text-teal-600 border-teal-200 border-dashed',
    badge: 'bg-teal-200/70 text-teal-800 border-teal-400',
    badgeTrial: 'bg-teal-100/70 text-teal-700 border-teal-300',
  },
  'Langues': {
    fixed: 'bg-amber-100 text-amber-800 border-amber-300 border-solid',
    trial: 'bg-amber-50 text-amber-600 border-amber-200 border-dashed',
    badge: 'bg-amber-200/70 text-amber-800 border-amber-400',
    badgeTrial: 'bg-amber-100/70 text-amber-700 border-amber-300',
  },
  'Informatique': {
    fixed: 'bg-purple-100 text-purple-800 border-purple-300 border-solid',
    trial: 'bg-purple-50 text-purple-600 border-purple-200 border-dashed',
    badge: 'bg-purple-200/70 text-purple-800 border-purple-400',
    badgeTrial: 'bg-purple-100/70 text-purple-700 border-purple-300',
  },
  'IT': {
    fixed: 'bg-purple-100 text-purple-800 border-purple-300 border-solid',
    trial: 'bg-purple-50 text-purple-600 border-purple-200 border-dashed',
    badge: 'bg-purple-200/70 text-purple-800 border-purple-400',
    badgeTrial: 'bg-purple-100/70 text-purple-700 border-purple-300',
  },
  'Préparation Concours': {
    fixed: 'bg-rose-100 text-rose-800 border-rose-300 border-solid',
    trial: 'bg-rose-50 text-rose-600 border-rose-200 border-dashed',
    badge: 'bg-rose-200/70 text-rose-800 border-rose-400',
    badgeTrial: 'bg-rose-100/70 text-rose-700 border-rose-300',
  },
};

const defaultColor = {
  fixed: 'bg-slate-100 text-slate-800 border-slate-300 border-solid',
  trial: 'bg-slate-50 text-slate-600 border-slate-200 border-dashed',
  badge: 'bg-slate-200/70 text-slate-800 border-slate-400',
  badgeTrial: 'bg-slate-100/70 text-slate-700 border-slate-300',
};

// Classroom badge colors
const classroomBadgeColors = [
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

function getSlotTop(time: string): number {
  return ((timeToMinutes(time) - FIRST_SLOT_MINUTES) / 30) * SLOT_HEIGHT;
}

function getSessionHeight(startTime: string, endTime: string): number {
  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  return (durationMinutes / 30) * SLOT_HEIGHT;
}

function getSlotCount(startTime: string, endTime: string): number {
  return (timeToMinutes(endTime) - timeToMinutes(startTime)) / 30;
}

const emptyForm: ScheduleFormData = {
  sessionType: 'fixed',
  isRecurring: false,
  daysOfWeek: [],
  dayOfWeek: '',
  startTime: '',
  endTime: '',
  classroomId: '',
  subjectId: '',
  teacherId: '',
  levelId: '',
  group: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ScheduleView() {
  const t = useT();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  const days = useMemo(() => getDays(t), [t]);

  // View state
  const [sessionFilter, setSessionFilter] = useState<'all' | 'fixed' | 'trial'>('all');

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);

  // Form
  const [form, setForm] = useState<ScheduleFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [conflictErrors, setConflictErrors] = useState<ConflictError[]>([]);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (sessionFilter !== 'all') {
        params.set('sessionType', sessionFilter);
      }
      const query = params.toString();
      const res = await fetch(`/api/schedules${query ? `?${query}` : ''}`);
      if (!res.ok) throw new Error('فشل في تحميل البيانات');
      const data = await res.json();
      setSchedules(data);
    } catch {
      toast.error('فشل في تحميل الجدول');
    } finally {
      setLoading(false);
    }
  }, [sessionFilter]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('فشل');
      const data = await res.json();
      setServices(data);
    } catch {
      toast.error('فشل في تحميل الخدمات');
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error('فشل');
      const data = await res.json();
      setTeachers(data);
    } catch {
      toast.error('فشل في تحميل الأساتذة');
    }
  }, []);

  const fetchClassrooms = useCallback(async () => {
    try {
      const res = await fetch('/api/classrooms');
      if (!res.ok) throw new Error('فشل');
      const data = await res.json();
      setClassrooms(data);
    } catch {
      toast.error('فشل في تحميل القاعات');
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    fetchServices();
    fetchTeachers();
    fetchClassrooms();
  }, [fetchServices, fetchTeachers, fetchClassrooms]);

  // ─── Computed Values ────────────────────────────────────────────────────

  // All subjects flat with service info
  const allSubjects = useMemo(() => {
    const subs: (Subject & { service: { id: string; name: string; nameAr: string } })[] = [];
    services.forEach((s) => {
      s.subjects.forEach((sub) => {
        subs.push({
          ...sub,
          serviceId: s.id,
          service: { id: s.id, name: s.name, nameAr: s.nameAr },
        });
      });
    });
    return subs;
  }, [services]);

  // Service name → color lookup
  const serviceColorLookup = useMemo(() => {
    const map: Record<string, typeof defaultColor> = {};
    services.forEach((s) => {
      const matched = Object.entries(serviceColorMap).find(
        ([key]) => key.toLowerCase() === s.name.toLowerCase()
      );
      map[s.id] = matched ? matched[1] : defaultColor;
    });
    return map;
  }, [services]);

  function getColorClasses(sched: Schedule) {
    const svcId = sched.subject?.service?.id || '';
    const colors = serviceColorLookup[svcId] || defaultColor;
    const isTrial = sched.sessionType === 'trial';
    return {
      cell: isTrial ? colors.trial : colors.fixed,
      badge: isTrial ? colors.badgeTrial : colors.badge,
    };
  }

  // Classroom color lookup by classroom id
  const classroomColorLookup = useMemo(() => {
    const map: Record<string, string> = {};
    classrooms.forEach((c, idx) => {
      map[c.id] = classroomBadgeColors[idx % classroomBadgeColors.length];
    });
    return map;
  }, [classrooms]);

  // Schedule count per day
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    days.forEach((d) => {
      let count = schedules.filter((s) => s.dayOfWeek === d.value);
      if (sessionFilter !== 'all') {
        count = count.filter((s) => s.sessionType === sessionFilter);
      }
      counts[d.value] = count.length;
    });
    return counts;
  }, [schedules, sessionFilter, days]);

  // Schedules grouped by day with overlap column info
  const schedulesByDay = useMemo(() => {
    const map: Record<string, {
      schedules: Schedule[];
      columns: Map<string, number>;
      totalColumns: number;
    }> = {};

    days.forEach((d) => {
      let dayScheds = schedules.filter((s) => s.dayOfWeek === d.value);
      if (sessionFilter !== 'all') {
        dayScheds = dayScheds.filter((s) => s.sessionType === sessionFilter);
      }

      // Compute overlap columns using greedy algorithm
      const sorted = [...dayScheds].sort((a, b) => {
        const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        if (startDiff !== 0) return startDiff;
        return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
      });

      const columns = new Map<string, number>();
      const endTimes: number[] = []; // end time for each column

      sorted.forEach((sched) => {
        const startMin = timeToMinutes(sched.startTime);
        let col = 0;
        while (col < endTimes.length && endTimes[col] > startMin) {
          col++;
        }
        columns.set(sched.id, col);
        if (col >= endTimes.length) {
          endTimes.push(0);
        }
        endTimes[col] = timeToMinutes(sched.endTime);
      });

      const totalColumns = Math.max(1, endTimes.length);
      map[d.value] = { schedules: dayScheds, columns, totalColumns };
    });
    return map;
  }, [schedules, sessionFilter, days]);

  // Levels for selected subject
  const selectedSubjectLevels = useMemo(() => {
    if (!form.subjectId) return [];
    const sub = allSubjects.find((s) => s.id === form.subjectId);
    return sub?.levels || [];
  }, [form.subjectId, allSubjects]);

  // Teachers filtered by subject
  const filteredTeachers = useMemo(() => {
    if (!form.subjectId) return teachers;
    return teachers.filter((t) => t.subjects.some((ts) => ts.subjectId === form.subjectId));
  }, [teachers, form.subjectId]);

  // Stats
  const fixedCount = schedules.filter((s) => s.sessionType === 'fixed').length;
  const trialCount = schedules.filter((s) => s.sessionType === 'trial').length;

  // ─── Client-side Conflict Detection ─────────────────────────────────────

  function checkClientConflicts(formData: ScheduleFormData, excludeId?: string): ConflictError[] {
    const errors: ConflictError[] = [];
    const daysToCheck = formData.isRecurring && formData.daysOfWeek.length > 0
      ? formData.daysOfWeek
      : formData.dayOfWeek ? [formData.dayOfWeek] : [];

    for (const day of daysToCheck) {
      const daySchedulesList = schedules.filter((s) => s.dayOfWeek === day);

      for (const existing of daySchedulesList) {
        if (excludeId && existing.id === excludeId) continue;
        if (!timesOverlap(formData.startTime, formData.endTime, existing.startTime, existing.endTime)) continue;

        if (formData.classroomId && existing.classroomId === formData.classroomId) {
          const dayLabel = days.find((d) => d.value === day)?.label || day;
          errors.push({
            type: 'classroom',
            message: `هذه القاعة مشغولة في ${dayLabel} من ${existing.startTime} إلى ${existing.endTime} (${existing.subject?.nameAr || existing.subject?.name})`,
          });
        }

        if (formData.teacherId && existing.teacherId === formData.teacherId) {
          const dayLabel = days.find((d) => d.value === day)?.label || day;
          errors.push({
            type: 'teacher',
            message: `هذا الأستاذ لديه حصة في ${dayLabel} من ${existing.startTime} إلى ${existing.endTime} (${existing.subject?.nameAr || existing.subject?.name})`,
          });
        }
      }
    }

    return errors;
  }

  // ─── Form Handlers ──────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingSchedule(null);
    setConflictErrors([]);
    setForm({ ...emptyForm, dayOfWeek: '' });
    setFormOpen(true);
  };

  const openEditDialog = (sched: Schedule) => {
    setEditingSchedule(sched);
    setConflictErrors([]);
    setForm({
      sessionType: (sched.sessionType === 'trial' ? 'trial' : 'fixed') as 'fixed' | 'trial',
      isRecurring: sched.isRecurring || false,
      daysOfWeek: [],
      dayOfWeek: sched.dayOfWeek,
      startTime: sched.startTime,
      endTime: sched.endTime,
      classroomId: sched.classroomId || '',
      subjectId: sched.subjectId,
      teacherId: sched.teacherId || '',
      levelId: sched.levelId || '',
      group: sched.group || '',
    });
    setFormOpen(true);
  };

  const handleSessionTypeChange = (val: string) => {
    setForm({
      ...form,
      sessionType: val as 'fixed' | 'trial',
      isRecurring: val === 'fixed' ? form.isRecurring : false,
      daysOfWeek: val === 'trial' ? [] : form.daysOfWeek,
    });
  };

  const toggleDay = (dayVal: string) => {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(dayVal)
        ? prev.daysOfWeek.filter((d) => d !== dayVal)
        : [...prev.daysOfWeek, dayVal],
    }));
  };

  const handleSubmit = async () => {
    setConflictErrors([]);

    // Validation
    if (form.sessionType === 'trial' && !form.dayOfWeek) {
      toast.error('يرجى اختيار يوم الأسبوع');
      return;
    }
    if (form.sessionType === 'fixed' && form.isRecurring && form.daysOfWeek.length === 0) {
      toast.error('يرجى اختيار يوم واحد على الأقل للتكرار');
      return;
    }
    if (!form.startTime || !form.endTime) {
      toast.error('يرجى تحديد أوقات الحصة');
      return;
    }
    if (!form.classroomId) {
      toast.error('يرجى اختيار القاعة');
      return;
    }
    if (!form.subjectId) {
      toast.error('يرجى اختيار المادة');
      return;
    }
    if (!form.teacherId) {
      toast.error('يرجى اختيار الأستاذ');
      return;
    }
    if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      toast.error('يجب أن يكون وقت النهاية بعد وقت البداية');
      return;
    }

    // Client-side conflict check
    const clientConflicts = checkClientConflicts(form, editingSchedule?.id);
    if (clientConflicts.length > 0) {
      setConflictErrors(clientConflicts);
      toast.error('يوجد تعارض في الجدول!');
      return;
    }

    setSubmitting(true);
    try {
      const isRecurring = form.sessionType === 'fixed' && form.isRecurring;
      const daysOfWeek = isRecurring ? form.daysOfWeek : [form.dayOfWeek];

      if (!daysOfWeek[0]) {
        toast.error('يرجى اختيار يوم');
        setSubmitting(false);
        return;
      }

      const body = {
        sessionType: form.sessionType,
        isRecurring,
        daysOfWeek: isRecurring ? form.daysOfWeek : undefined,
        dayOfWeek: daysOfWeek[0],
        startTime: form.startTime,
        endTime: form.endTime,
        classroomId: form.classroomId,
        subjectId: form.subjectId,
        teacherId: form.teacherId || null,
        levelId: form.levelId || null,
        group: form.group || null,
      };

      const url = editingSchedule
        ? `/api/schedules/${editingSchedule.id}`
        : '/api/schedules';
      const method = editingSchedule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const errorData = await res.json();
        const conflicts: ConflictError[] = (errorData.conflicts || []).map(
          (c: { type: string; message: string }) => ({
            type: c.type as 'classroom' | 'teacher',
            message: c.message,
          })
        );
        setConflictErrors(conflicts);
        toast.error('يوجد تعارض في الجدول!');
        setSubmitting(false);
        return;
      }

      if (!res.ok) throw new Error('فشل في حفظ البيانات');

      toast.success(
        editingSchedule ? 'تم تحديث الحصة بنجاح' : 'تم إضافة الحصة بنجاح'
      );
      setFormOpen(false);
      fetchSchedules();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSchedule) return;
    try {
      const res = await fetch(`/api/schedules/${deletingSchedule.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('فشل في الحذف');
      toast.success('تم حذف الحصة بنجاح');
      setDeleteOpen(false);
      setDeletingSchedule(null);
      fetchSchedules();
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  // ─── Print Schedule (Weekly View) ───────────────────────────────────────

  const handlePrint = () => {
    const dateStr = new Date().toLocaleDateString('ar-MA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Compute service color for print
    function getServiceColor(svcId: string): string {
      const svc = services.find((s) => s.id === svcId);
      if (!svc) return '#f1f5f9';
      const name = svc.name.toLowerCase();
      if (name.includes('soutien')) return '#f0fdfa';
      if (name.includes('langue')) return '#fffbeb';
      if (name.includes('informatique') || name === 'it') return '#faf5ff';
      if (name.includes('concours')) return '#fff1f2';
      return '#f8fafc';
    }

    function getServiceBorderColor(svcId: string): string {
      const svc = services.find((s) => s.id === svcId);
      if (!svc) return '#e2e8f0';
      const name = svc.name.toLowerCase();
      if (name.includes('soutien')) return '#14b8a6';
      if (name.includes('langue')) return '#f59e0b';
      if (name.includes('informatique') || name === 'it') return '#a855f7';
      if (name.includes('concours')) return '#f43f5e';
      return '#94a3b8';
    }

    let html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 15px; color: #1a1a1a; font-size: 11px; }
        .header { text-align: center; margin-bottom: 15px; padding: 12px; background: linear-gradient(135deg, #0d9488, #14b8a6); color: white; border-radius: 8px; }
        .header h1 { font-size: 20px; margin-bottom: 2px; }
        .header p { font-size: 12px; opacity: 0.9; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { background: #f1f5f9; padding: 6px 4px; border: 1px solid #e2e8f0; font-weight: bold; text-align: center; font-size: 11px; }
        td { padding: 4px; border: 1px solid #e2e8f0; vertical-align: top; }
        .time-cell { text-align: center; font-weight: bold; white-space: nowrap; font-size: 10px; width: 50px; }
        .day-cell { width: auto; min-width: 100px; }
        .session-cell { padding: 3px 4px; border-radius: 3px; font-size: 9px; margin-bottom: 2px; border-right: 3px solid; }
        .session-cell strong { font-size: 10px; }
        .footer { text-align: center; margin-top: 10px; font-size: 10px; color: #94a3b8; }
        .meta { text-align: center; margin-bottom: 10px; font-size: 11px; color: #64748b; }
        @page { size: landscape; margin: 10mm; }
        @media print { body { padding: 5px; } }
      </style></head><body>`;
    html += `<div class="header"><h1>AURA ACADEMY</h1><p>بني ملال — الجدول الأسبوعي</p></div>`;
    html += `<div class="meta">${dateStr} | إجمالي الحصص: ${schedules.length}</div>`;
    html += `<table><thead><tr><th class="time-cell">الوقت</th>`;

    days.forEach((d) => {
      const count = dayCounts[d.value] || 0;
      html += `<th class="day-cell">${d.label} <span style="opacity:0.6">(${count})</span></th>`;
    });
    html += `</tr></thead><tbody>`;

    timeSlots.forEach((time, timeIdx) => {
      // Only show even time slots (full hours) for cleaner layout
      if (timeIdx % 2 !== 0) return;

      html += `<tr>`;
      html += `<td class="time-cell" rowspan="2">${time}<br/>${timeSlots[timeIdx + 1] || ''}</td>`;

      days.forEach((d) => {
        const dayData = schedulesByDay[d.value];
        if (!dayData) { html += `<td class="day-cell"></td>`; return; }

        // Find sessions that START at this time slot
        const slotMin = timeToMinutes(time);
        const startScheds = dayData.schedules.filter(
          (s) => timeToMinutes(s.startTime) === slotMin
        );

        // Find sessions that SPAN this time slot (started earlier)
        const spanScheds = dayData.schedules.filter(
          (s) => timeToMinutes(s.startTime) < slotMin && timeToMinutes(s.endTime) > slotMin
        );

        if (startScheds.length === 0 && spanScheds.length === 0) {
          html += `<td class="day-cell"></td>`;
        } else if (spanScheds.length > 0 && startScheds.length === 0) {
          // This cell is spanned — don't output td (rowspan handles it)
          // Actually for the print table we can't easily do rowspan with overlapping sessions
          // Just leave it empty — the starting cell covers it visually
          html += `<td class="day-cell" style="display:none;"></td>`;
        } else {
          html += `<td class="day-cell" rowspan="${Math.max(1, Math.ceil(startScheds.reduce((max, s) => {
            const span = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
            return Math.max(max, span / 60);
          }, 1)))}">`;

          startScheds.forEach((sess) => {
            const bg = getServiceColor(sess.subject?.service?.id || '');
            const border = getServiceBorderColor(sess.subject?.service?.id || '');
            html += `<div class="session-cell" style="background:${bg};border-color:${border};">
              <strong>${sess.subject?.nameAr || sess.subject?.name}</strong>
              ${sess.level ? `<br/>${sess.level?.nameAr || sess.level?.name}` : ''}
              ${sess.teacher ? `<br/><span style="color:#64748b;">${sess.teacher.fullName}</span>` : ''}
              ${sess.classroom ? `<br/><span style="color:#0d9488;font-size:8px;">📍 ${sess.classroom.nameAr || sess.classroom.name}</span>` : ''}
              ${sess.sessionType === 'trial' ? '<br/><span style="color:#f59e0b;font-size:8px;">⚡ تجريبية</span>' : ''}
              ${sess.group ? `<br/><span style="color:#94a3b8;font-size:8px;">👥 ${sess.group}</span>` : ''}
              <br/><span style="font-size:8px;color:#94a3b8;">${sess.startTime}-${sess.endTime}</span>
            </div>`;
          });

          html += `</td>`;
        }
      });

      html += `</tr>`;
    });

    html += `</tbody></table>`;
    html += `<div class="footer">Aura Academy - بني ملال | الجدول الأسبوعي للحصص</div>`;
    html += `</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const totalGridHeight = timeSlots.length * SLOT_HEIGHT;
  const totalMinWidth = TIME_COLUMN_WIDTH + 7 * DAY_COLUMN_WIDTH;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">جدول الحصص</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">طباعة</span>
            </Button>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة حصة
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">إجمالي الحصص</p>
              </div>
              <p className="text-lg font-bold mt-0.5">{schedules.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-teal-500" />
                <p className="text-xs text-muted-foreground">حصص ثابتة</p>
              </div>
              <p className="text-lg font-bold text-teal-600 mt-0.5">{fixedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-muted-foreground">حصص تجريبية</p>
              </div>
              <p className="text-lg font-bold text-amber-600 mt-0.5">{trialCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Session Type Filter */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={sessionFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSessionFilter('all')}
            className="text-xs px-3"
          >
            الكل
          </Button>
          <Button
            variant={sessionFilter === 'fixed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSessionFilter('fixed')}
            className="text-xs px-3 gap-1"
          >
            <CalendarDays className="h-3 w-3" />
            ثابتة
          </Button>
          <Button
            variant={sessionFilter === 'trial' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSessionFilter('trial')}
            className="text-xs px-3 gap-1"
          >
            <Zap className="h-3 w-3" />
            تجريبية
          </Button>
        </div>

        {/* Weekly Schedule Grid */}
        {loading ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="w-full" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                <div style={{ minWidth: `${totalMinWidth}px` }}>
                  {/* Header Row - Day Names */}
                  <div
                    className="sticky top-0 z-20 bg-background border-b flex"
                    style={{ height: '44px' }}
                  >
                    {/* Time header */}
                    <div
                      className="shrink-0 border-l flex items-center justify-center bg-muted/40"
                      style={{ width: `${TIME_COLUMN_WIDTH}px` }}
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>

                    {/* Day column headers */}
                    {days.map((day) => {
                      const count = dayCounts[day.value] || 0;
                      return (
                        <div
                          key={day.value}
                          className="shrink-0 border-l last:border-l-0 flex items-center justify-center gap-1.5 px-1"
                          style={{ width: `${DAY_COLUMN_WIDTH}px` }}
                        >
                          <span className="text-xs font-bold truncate">
                            {day.label}
                          </span>
                          {count > 0 && (
                            <Badge
                              variant="secondary"
                              className="h-4 min-w-4 px-1 text-[10px] shrink-0"
                            >
                              {count}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid Body */}
                  <div className="flex">
                    {/* Time Labels Column - sticky left in RTL (right side) */}
                    <div
                      className="shrink-0 border-l border-gray-400 bg-muted/10 sticky right-0 z-10"
                      style={{ width: `${TIME_COLUMN_WIDTH}px` }}
                    >
                      {timeSlots.map((time, index) => (
                        <div
                          key={time}
                          className={cn(
                            'flex items-start justify-center border-b',
                            index % 2 === 0
                              ? 'border-gray-400'
                              : 'border-gray-200 border-dashed'
                          )}
                          style={{ height: `${SLOT_HEIGHT}px` }}
                        >
                          <span
                            dir="ltr"
                            className={cn(
                              'font-mono mt-1',
                              index % 2 === 0
                                ? 'text-[10px] font-bold text-gray-700'
                                : 'text-[9px] text-gray-400'
                            )}
                          >
                            {time}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Day Columns */}
                    {days.map((day) => {
                      const dayData = schedulesByDay[day.value];
                      return (
                        <div
                          key={day.value}
                          className="shrink-0 border-l border-gray-300 last:border-l-0 relative"
                          style={{ width: `${DAY_COLUMN_WIDTH}px` }}
                        >
                          {/* Grid lines */}
                          <div style={{ height: `${totalGridHeight}px` }}>
                            {timeSlots.map((_, index) => (
                              <div
                                key={index}
                                className={cn(
                                  'border-b',
                                  index % 2 === 0
                                    ? 'border-gray-400'
                                    : 'border-gray-200 border-dashed'
                                )}
                                style={{ height: `${SLOT_HEIGHT}px` }}
                              />
                            ))}

                            {/* Sessions */}
                            {dayData && dayData.schedules.map((sched) => {
                              const top = getSlotTop(sched.startTime);
                              const height = getSessionHeight(sched.startTime, sched.endTime);
                              const { cell, badge } = getColorClasses(sched);
                              const isTrial = sched.sessionType === 'trial';
                              const slotCount = getSlotCount(sched.startTime, sched.endTime);

                              // Overlap positioning
                              const colIndex = dayData.columns.get(sched.id) || 0;
                              const totalCols = dayData.totalColumns;
                              const widthPercent = 100 / totalCols;
                              const rightOffset = colIndex * widthPercent;

                              return (
                                <div
                                  key={sched.id}
                                  className={cn(
                                    'absolute rounded-md border-2 px-1.5 py-1 cursor-pointer hover:shadow-md transition-all group overflow-hidden',
                                    cell
                                  )}
                                  style={{
                                    top: `${top + 1}px`,
                                    height: `${Math.max(height - 2, 20)}px`,
                                    width: `calc(${widthPercent}% - 4px)`,
                                    right: `calc(${rightOffset}% + 2px)`,
                                  }}
                                  onClick={() => openEditDialog(sched)}
                                >
                                  {/* Session type badge */}
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[7px] px-1 py-0 h-3 mb-0.5 leading-none',
                                      badge
                                    )}
                                  >
                                    {isTrial ? '⚡' : '📌'}
                                  </Badge>

                                  {/* Subject + Level */}
                                  <p className="text-[10px] font-bold leading-tight truncate">
                                    {sched.subject?.nameAr || sched.subject?.name}
                                    {sched.level && (
                                      <span className="font-normal opacity-80 mr-0.5">
                                        — {sched.level?.nameAr || sched.level?.name}
                                      </span>
                                    )}
                                  </p>

                                  {/* Classroom badge */}
                                  {sched.classroom && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className={cn(
                                            'inline-block text-[7px] px-1 py-0 rounded border leading-none mt-0.5 truncate max-w-full',
                                            classroomColorLookup[sched.classroomId] || 'bg-slate-100 text-slate-600 border-slate-200'
                                          )}
                                        >
                                          📍 {sched.classroom.nameAr || sched.classroom.name}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p>{sched.classroom.nameAr || sched.classroom.name}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}

                                  {/* Teacher */}
                                  {sched.teacher && (
                                    <p className="text-[9px] leading-tight truncate opacity-75 mt-0.5">
                                      👨‍🏫 {sched.teacher.fullName}
                                    </p>
                                  )}

                                  {/* Time range */}
                                  {slotCount >= 2 && (
                                    <div className="flex items-center mt-0.5">
                                      <span
                                        className="text-[8px] opacity-50 font-mono"
                                        dir="ltr"
                                      >
                                        {sched.startTime}-{sched.endTime}
                                      </span>
                                      {sched.group && (
                                        <span className="text-[8px] opacity-60 truncate mr-1">
                                          👥 {sched.group}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Group name for short sessions */}
                                  {slotCount < 2 && sched.group && (
                                    <p className="text-[8px] leading-tight truncate opacity-60 mt-0.5">
                                      👥 {sched.group}
                                    </p>
                                  )}

                                  {/* Hover overlay with actions */}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-md" />

                                  {/* Action buttons on hover */}
                                  <div className="absolute top-0.5 left-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      className="h-4 w-4 rounded-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingSchedule(sched);
                                        setDeleteOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-2 w-2" />
                                    </Button>
                                  </div>

                                  {/* Edit icon on hover */}
                                  <div className="absolute top-0.5 left-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Edit2 className="h-2.5 w-2.5 opacity-40" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        )}



        {/* ─── Add/Edit Dialog ──────────────────────────────────────────────── */}
        <Dialog open={formOpen} onOpenChange={(open) => { if (!open) setConflictErrors([]); setFormOpen(open); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'تعديل الحصة' : 'إضافة حصة جديدة'}
              </DialogTitle>
              <DialogDescription>
                {editingSchedule
                  ? 'قم بتعديل بيانات الحصة'
                  : 'أدخل بيانات الحصة الجديدة'}
              </DialogDescription>
            </DialogHeader>

            {/* Conflict errors */}
            {conflictErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-destructive text-sm font-bold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>يوجد تعارض في الجدول!</span>
                </div>
                {conflictErrors.map((err, idx) => (
                  <p key={idx} className="text-xs text-destructive/90 flex items-start gap-1.5 mr-6">
                    <span className="shrink-0 mt-0.5">
                      {err.type === 'classroom' ? '🏫' : '👨‍🏫'}
                    </span>
                    {err.message}
                  </p>
                ))}
              </div>
            )}

            <div className="space-y-4 max-h-[60vh] overflow-y-auto -mx-6 px-6">
              {/* Session Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">نوع الحصة *</Label>
                <RadioGroup
                  value={form.sessionType}
                  onValueChange={handleSessionTypeChange}
                  className="flex gap-3"
                  dir="rtl"
                >
                  <div className="flex items-center gap-2 rounded-lg border p-3 flex-1 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="fixed" id="type-fixed" />
                    <Label htmlFor="type-fixed" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-teal-500" />
                        <span className="font-medium text-sm">ثابتة (مكررة)</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        حصة تتكرر أسبوعياً
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border p-3 flex-1 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="trial" id="type-trial" />
                    <Label htmlFor="type-trial" className="cursor-pointer flex-1">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-sm">تجريبية</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        حصة تجريبية واحدة
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* Day selection */}
              {form.sessionType === 'trial' ? (
                <div>
                  <Label>يوم الأسبوع *</Label>
                  <Select
                    value={form.dayOfWeek}
                    onValueChange={(val) => setForm({ ...form, dayOfWeek: val })}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="اختر اليوم" />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Recurring checkbox */}
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Checkbox
                      id="recurring"
                      checked={form.isRecurring}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          isRecurring: !!checked,
                          daysOfWeek: !!checked ? form.daysOfWeek : [],
                        })
                      }
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="recurring"
                        className="cursor-pointer font-medium text-sm"
                      >
                        ثابت (مكرر أسبوعياً)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        سيتم إنشاء حصة لكل يوم محدد
                      </p>
                    </div>
                  </div>

                  {form.isRecurring ? (
                    <div>
                      <Label className="text-sm mb-2 block">أيام التكرار *</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {days.map((d) => (
                          <div
                            key={d.value}
                            className={cn(
                              'flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-colors',
                              form.daysOfWeek.includes(d.value)
                                ? 'bg-primary/10 border-primary text-primary'
                                : 'hover:bg-muted/50'
                            )}
                            onClick={() => toggleDay(d.value)}
                          >
                            <Checkbox
                              checked={form.daysOfWeek.includes(d.value)}
                              onCheckedChange={() => toggleDay(d.value)}
                              className="pointer-events-none"
                            />
                            <span className="text-xs font-medium">{d.short}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label>يوم الأسبوع *</Label>
                      <Select
                        value={form.dayOfWeek}
                        onValueChange={(val) => setForm({ ...form, dayOfWeek: val })}
                      >
                        <SelectTrigger className="w-full mt-1.5">
                          <SelectValue placeholder="اختر اليوم" />
                        </SelectTrigger>
                        <SelectContent>
                          {days.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Time selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>من الساعة *</Label>
                  <Select
                    value={form.startTime}
                    onValueChange={(val) => setForm({ ...form, startTime: val })}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="البداية" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((t) => (
                        <SelectItem key={t} value={t}>
                          <span dir="ltr">{t}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>إلى الساعة *</Label>
                  <Select
                    value={form.endTime}
                    onValueChange={(val) => setForm({ ...form, endTime: val })}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="النهاية" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((t) => (
                        <SelectItem key={t} value={t}>
                          <span dir="ltr">{t}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Duration indicator */}
              {form.startTime && form.endTime && timeToMinutes(form.endTime) > timeToMinutes(form.startTime) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    المدة:{' '}
                    {(() => {
                      const diff = timeToMinutes(form.endTime) - timeToMinutes(form.startTime);
                      const hours = Math.floor(diff / 60);
                      const mins = diff % 60;
                      return hours > 0 ? `${hours} س ${mins > 0 ? `و ${mins} د` : ''}` : `${mins} دقيقة`;
                    })()}
                  </span>
                  <span>({getSlotCount(form.startTime, form.endTime)} حصة)</span>
                </div>
              )}

              {/* Classroom */}
              <div>
                <Label>القاعة *</Label>
                <Select
                  value={form.classroomId}
                  onValueChange={(val) => setForm({ ...form, classroomId: val })}
                >
                  <SelectTrigger className="w-full mt-1.5">
                    <SelectValue placeholder="اختر القاعة" />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        <span className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {room.nameAr || room.name}
                          <span className="text-muted-foreground text-xs">
                            ({room.capacity})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Subject */}
              <div>
                <Label>المادة *</Label>
                <Select
                  value={form.subjectId}
                  onValueChange={(val) =>
                    setForm({ ...form, subjectId: val, teacherId: '', levelId: '' })
                  }
                >
                  <SelectTrigger className="w-full mt-1.5">
                    <SelectValue placeholder="اختر المادة" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectGroup key={service.id}>
                        <SelectLabel>{service.nameAr || service.name}</SelectLabel>
                        {service.subjects.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.nameAr || sub.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Level */}
              <div>
                <Label>المستوى</Label>
                <Select
                  value={form.levelId}
                  onValueChange={(val) => setForm({ ...form, levelId: val })}
                  disabled={!form.subjectId || selectedSubjectLevels.length === 0}
                >
                  <SelectTrigger className="w-full mt-1.5">
                    <SelectValue
                      placeholder={
                        form.subjectId
                          ? selectedSubjectLevels.length > 0
                            ? 'اختر المستوى'
                            : 'لا توجد مستويات'
                          : 'اختر المادة أولاً'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSubjectLevels.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.nameAr || level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Teacher */}
              <div>
                <Label>الأستاذ *</Label>
                <Select
                  value={form.teacherId}
                  onValueChange={(val) => setForm({ ...form, teacherId: val })}
                  disabled={!form.subjectId}
                >
                  <SelectTrigger className="w-full mt-1.5">
                    <SelectValue
                      placeholder={
                        form.subjectId
                          ? filteredTeachers.length > 0
                            ? 'اختر الأستاذ'
                            : 'لا يوجد أساتذة لهذه المادة'
                          : 'اختر المادة أولاً'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTeachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Group name */}
              <div>
                <Label htmlFor="group">اسم المجموعة</Label>
                <Input
                  id="group"
                  value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })}
                  placeholder="مثلاً: المجموعة أ"
                  className="mt-1.5"
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {editingSchedule && (
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => {
                    setFormOpen(false);
                    setDeletingSchedule(editingSchedule);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  حذف
                </Button>
              )}
              <div className="flex gap-2 w-full sm:w-auto sm:mr-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    setConflictErrors([]);
                    setFormOpen(false);
                  }}
                  disabled={submitting}
                  className="flex-1 sm:flex-none"
                >
                  إلغاء
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none gap-2">
                  {submitting && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  {editingSchedule ? 'تحديث' : 'إضافة'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Delete Confirmation ──────────────────────────────────────────── */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذه الحصة؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
