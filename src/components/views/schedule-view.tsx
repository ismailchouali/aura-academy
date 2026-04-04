'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
  Plus,
  Trash2,
  CalendarDays,
  Clock,
  MapPin,
  Filter,
  Users,
  Zap,
  CalendarCheck,
} from 'lucide-react';

// Types
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
}

interface Schedule {
  id: string;
  subjectId: string;
  subject: { name: string; nameAr: string; service?: { id: string; name: string; nameAr: string } };
  teacherId: string;
  teacher: { fullName: string };
  classroomId: string;
  classroom: { name: string; nameAr: string };
  levelId: string;
  level: { name: string; nameAr: string };
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  group: string;
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

// Constants
const days = [
  { value: '1', label: 'الأحد' },
  { value: '2', label: 'الإثنين' },
  { value: '3', label: 'الثلاثاء' },
  { value: '4', label: 'الأربعاء' },
  { value: '5', label: 'الخميس' },
  { value: '6', label: 'الجمعة' },
  { value: '7', label: 'السبت' },
];

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

// Service-based color mapping
const serviceColorMap: Record<string, { fixed: string; trial: string }> = {
  'Cours de Soutiens': {
    fixed: 'bg-teal-100 text-teal-800 border-teal-300 border-solid',
    trial: 'bg-teal-50 text-teal-700 border-teal-300 border-dashed',
  },
  'Langues': {
    fixed: 'bg-violet-100 text-violet-800 border-violet-300 border-solid',
    trial: 'bg-violet-50 text-violet-700 border-violet-300 border-dashed',
  },
  'IT': {
    fixed: 'bg-amber-100 text-amber-800 border-amber-300 border-solid',
    trial: 'bg-amber-50 text-amber-700 border-amber-300 border-dashed',
  },
  'Préparation Concours': {
    fixed: 'bg-rose-100 text-rose-800 border-rose-300 border-solid',
    trial: 'bg-rose-50 text-rose-700 border-rose-300 border-dashed',
  },
};

const defaultColor = {
  fixed: 'bg-sky-100 text-sky-800 border-sky-300 border-solid',
  trial: 'bg-sky-50 text-sky-700 border-sky-300 border-dashed',
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
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

export function ScheduleView() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'fixed' | 'trial'>('all');

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);

  // Form
  const [form, setForm] = useState<ScheduleFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchSchedules = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedClassroom && selectedClassroom !== 'all') {
        params.set('classroomId', selectedClassroom);
      }
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
  }, [selectedClassroom, sessionFilter]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('فشل في تحميل الخدمات');
      const data = await res.json();
      setServices(data);
    } catch {
      toast.error('فشل في تحميل الخدمات');
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error('فشل في تحميل البيانات');
      const data = await res.json();
      setTeachers(data);
    } catch {
      toast.error('فشل في تحميل الأساتذة');
    }
  }, []);

  const fetchClassrooms = useCallback(async () => {
    try {
      const res = await fetch('/api/classrooms');
      if (!res.ok) throw new Error('فشل في تحميل القاعات');
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

  // Get all subjects flat with service info
  const allSubjects = useMemo(() => {
    const subs: (Subject & { serviceId: string; service: { id: string; name: string; nameAr: string } })[] = [];
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

  // Build service name -> color lookup
  const serviceColorLookup = useMemo(() => {
    const map: Record<string, { fixed: string; trial: string }> = {};
    services.forEach((s) => {
      const matched = Object.entries(serviceColorMap).find(
        ([key]) => key.toLowerCase() === s.name.toLowerCase()
      );
      map[s.id] = matched ? matched[1] : defaultColor;
    });
    return map;
  }, [services]);

  function getColorClass(sched: Schedule): string {
    const svcId = sched.subject?.service?.id || '';
    const colors = serviceColorLookup[svcId] || defaultColor;
    return sched.sessionType === 'trial' ? colors.trial : colors.fixed;
  }

  // Get levels for selected subject
  const selectedSubjectLevels = useMemo(() => {
    if (!form.subjectId) return [];
    const sub = allSubjects.find((s) => s.id === form.subjectId);
    return sub?.levels || [];
  }, [form.subjectId, allSubjects]);

  // Filter teachers by selected subject
  const filteredTeachers = useMemo(() => {
    if (!form.subjectId) return teachers;
    return teachers.filter((t) => t.subjects.some((ts) => ts.subjectId === form.subjectId));
  }, [teachers, form.subjectId]);

  // Build schedule grid
  const scheduleGrid = useMemo(() => {
    const grid: Record<string, Record<string, Schedule[]>> = {};

    days.forEach((d) => {
      grid[d.value] = {};
      timeSlots.forEach((t) => {
        grid[d.value][t] = [];
      });
    });

    schedules.forEach((sched) => {
      const startMin = timeToMinutes(sched.startTime);
      const endMin = timeToMinutes(sched.endTime);
      const dayKey = sched.dayOfWeek;

      timeSlots.forEach((slot) => {
        const slotMin = timeToMinutes(slot);
        if (slotMin >= startMin && slotMin < endMin) {
          if (!grid[dayKey]) grid[dayKey] = {};
          if (!grid[dayKey][slot]) grid[dayKey][slot] = [];
          if (!grid[dayKey][slot].find((s) => s.id === sched.id)) {
            grid[dayKey][slot].push(sched);
          }
        }
      });
    });

    return grid;
  }, [schedules]);

  // Form handlers
  const openCreateDialog = () => {
    setEditingSchedule(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditDialog = (sched: Schedule) => {
    setEditingSchedule(sched);
    setForm({
      sessionType: (sched.sessionType === 'trial' ? 'trial' : 'fixed') as 'fixed' | 'trial',
      isRecurring: sched.isRecurring || false,
      daysOfWeek: [],
      dayOfWeek: sched.dayOfWeek,
      startTime: sched.startTime,
      endTime: sched.endTime,
      classroomId: sched.classroomId,
      subjectId: sched.subjectId,
      teacherId: sched.teacherId,
      levelId: sched.levelId,
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
    if (!form.classroomId || !form.subjectId) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      toast.error('يجب أن يكون وقت النهاية بعد وقت البداية');
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

  // Stats
  const fixedCount = schedules.filter((s) => s.sessionType === 'fixed').length;
  const trialCount = schedules.filter((s) => s.sessionType === 'trial').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">جدول الحصص</h2>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة ومتابعة الجدول الأسبوعي للمركز
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة حصة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">إجمالي الحصص</p>
            </div>
            <p className="text-lg font-bold mt-1">{schedules.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground">حصص ثابتة</p>
            </div>
            <p className="text-lg font-bold text-emerald-600 mt-1">{fixedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">حصص تجريبية</p>
            </div>
            <p className="text-lg font-bold text-amber-600 mt-1">{trialCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Session type filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground ml-1">نوع الحصة:</span>
          <Button
            variant={sessionFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSessionFilter('all')}
            className="gap-1.5"
          >
            <Users className="h-3.5 w-3.5" />
            الكل
          </Button>
          <Button
            variant={sessionFilter === 'fixed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSessionFilter('fixed')}
            className="gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            حصص ثابتة
          </Button>
          <Button
            variant={sessionFilter === 'trial' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSessionFilter('trial')}
            className="gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            حصص تجريبية
          </Button>
        </div>

        {/* Classroom tabs */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            القاعة:
          </span>
          <Button
            variant={selectedClassroom === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedClassroom('all')}
          >
            الكل
          </Button>
          {classrooms.map((room) => (
            <Button
              key={room.id}
              variant={selectedClassroom === room.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedClassroom(room.id)}
            >
              {room.nameAr || room.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Schedule Grid */}
      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-10 w-20 shrink-0" />
                <div className="flex-1 flex gap-2">
                  {[...Array(7)].map((_, j) => (
                    <Skeleton key={j} className="h-10 flex-1" />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="w-full" style={{ maxHeight: 'calc(100vh - 360px)' }}>
              <div className="min-w-[900px]">
                {/* Header row with day names */}
                <div className="sticky top-0 z-10 bg-background border-b grid grid-cols-[80px_repeat(7,1fr)]">
                  <div className="p-2 text-xs font-medium text-muted-foreground text-center border-l flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  {days.map((day) => (
                    <div
                      key={day.value}
                      className="p-2 text-xs font-bold text-center border-l last:border-l-0"
                    >
                      {day.label}
                    </div>
                  ))}
                </div>

                {/* Time rows */}
                {timeSlots.map((time) => (
                  <div
                    key={time}
                    className="grid grid-cols-[80px_repeat(7,1fr)] min-h-[44px]"
                  >
                    {/* Time label */}
                    <div className="p-1.5 text-xs text-muted-foreground text-center border-b border-l flex items-center justify-center bg-muted/30">
                      <span dir="ltr" className="font-mono text-[11px]">{time}</span>
                    </div>

                    {/* Day cells */}
                    {days.map((day) => {
                      const cellSchedules = scheduleGrid[day.value]?.[time] || [];
                      return (
                        <div
                          key={`${day.value}-${time}`}
                          className="border-b border-l last:border-l-0 p-0.5 min-h-[44px] relative"
                        >
                          {cellSchedules.length > 0 ? (
                            cellSchedules.map((sched) => {
                              const isStart =
                                timeToMinutes(sched.startTime) === timeToMinutes(time);

                              if (!isStart) return null;

                              const durationSlots =
                                (timeToMinutes(sched.endTime) -
                                  timeToMinutes(sched.startTime)) /
                                30;

                              const isTrial = sched.sessionType === 'trial';
                              const colorClass = getColorClass(sched);

                              return (
                                <div
                                  key={sched.id}
                                  className={cn(
                                    'absolute inset-x-0.5 top-0.5 rounded-md border-2 px-1.5 py-1 cursor-pointer hover:opacity-90 transition-opacity group z-[5]',
                                    colorClass,
                                    isTrial && 'border-dashed bg-opacity-50'
                                  )}
                                  style={{
                                    height: `calc(${durationSlots * 44}px - 4px)`,
                                  }}
                                  onClick={() => openEditDialog(sched)}
                                >
                                  {/* Session type badge */}
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[7px] px-1 py-0 h-3 mb-0.5',
                                      isTrial
                                        ? 'bg-orange-200/60 text-orange-700 border-orange-300'
                                        : 'bg-emerald-200/60 text-emerald-700 border-emerald-300'
                                    )}
                                  >
                                    {isTrial ? 'تجريبية' : 'ثابتة'}
                                  </Badge>

                                  {/* Subject + Level */}
                                  <p className="text-[10px] font-bold leading-tight truncate">
                                    {sched.subject?.nameAr || sched.subject?.name}
                                    {sched.level && (
                                      <span className="font-normal opacity-80">
                                        {' '}{sched.level?.nameAr || sched.level?.name}
                                      </span>
                                    )}
                                  </p>

                                  {/* Teacher */}
                                  {sched.teacher && (
                                    <p className="text-[9px] leading-tight truncate opacity-75">
                                      {sched.teacher.fullName}
                                    </p>
                                  )}

                                  {/* Classroom + Time */}
                                  <div className="flex items-center justify-between mt-0.5">
                                    {selectedClassroom === 'all' && sched.classroom && (
                                      <span className="text-[8px] opacity-60 truncate">
                                        {sched.classroom?.nameAr || sched.classroom?.name}
                                      </span>
                                    )}
                                    <span className="text-[8px] opacity-50 mr-auto" dir="ltr">
                                      {sched.startTime}-{sched.endTime}
                                    </span>
                                  </div>

                                  {/* Group name */}
                                  {sched.group && (
                                    <p className="text-[8px] leading-tight truncate opacity-60 mt-0.5">
                                      <Users className="inline h-2.5 w-2.5 ml-0.5" />
                                      {sched.group}
                                    </p>
                                  )}

                                  {/* Delete button on hover */}
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-0.5 left-0.5 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingSchedule(sched);
                                      setDeleteOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              );
                            })
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty state for no classrooms */}
      {!loading && classrooms.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">لا توجد قاعات</p>
            <p className="text-sm text-muted-foreground mt-1">
              قم بإضافة القاعات أولاً من صفحة القاعات
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
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

          <div className="space-y-4 max-h-[65vh] overflow-y-auto -mx-6 px-6">
            {/* Session Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">نوع الحصة *</Label>
              <RadioGroup
                value={form.sessionType}
                onValueChange={handleSessionTypeChange}
                className="flex gap-4"
                dir="rtl"
              >
                <div className="flex items-center gap-2 rounded-lg border p-3 flex-1 cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="fixed" id="type-fixed" />
                  <Label htmlFor="type-fixed" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-emerald-500" />
                      <span className="font-medium text-sm">ثابتة (مكررة)</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">حصة تتكرر أسبوعياً</p>
                  </Label>
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-3 flex-1 cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="trial" id="type-trial" />
                  <Label htmlFor="type-trial" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-sm">تجريبية</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">حصة تجريبية واحدة</p>
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
                    <Label htmlFor="recurring" className="cursor-pointer font-medium text-sm">
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
                          <span className="text-xs font-medium">{d.label}</span>
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
                      {room.nameAr || room.name}
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
                onClick={() => setFormOpen(false)}
                disabled={submitting}
                className="flex-1 sm:flex-none"
              >
                إلغاء
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1 sm:flex-none">
                {submitting
                  ? 'جاري الحفظ...'
                  : editingSchedule
                  ? 'تحديث الحصة'
                  : 'إضافة الحصة'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الحصة من الجدول؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
