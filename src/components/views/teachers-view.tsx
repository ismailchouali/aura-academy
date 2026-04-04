'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  GraduationCap,
  Phone,
  Mail,
  MapPin,
  Eye,
  CalendarDays,
  Clock,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Wallet,
  BookOpen,
  Users,
  ArrowLeftRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────

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
}

interface Service {
  id: string;
  name: string;
  nameAr: string;
  subjects: Subject[];
}

interface TeacherSubject {
  id: string;
  teacherId: string;
  subjectId: string;
  subject: {
    id: string;
    name: string;
    nameAr: string;
    levels: Level[];
  };
}

interface Student {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  teacherId: string;
  teacher: { id: string; fullName: string } | null;
  level: {
    name: string;
    nameAr: string;
    subject: { name: string; nameAr: string; service: { name: string; nameAr: string } };
  } | null;
  status: string;
}

interface Teacher {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  salary: number;
  percentage: number;
  notes: string;
  status: 'active' | 'inactive';
  subjects: TeacherSubject[];
  schedules: any[];
  payments: any[];
}

interface TeacherFormData {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  salary: string;
  percentage: string;
  notes: string;
  status: 'active' | 'inactive';
}

interface SubjectAssignment {
  subjectId: string;
  levelIds: string[];
}

type StatusFilter = 'all' | 'active' | 'inactive';

const emptyForm: TeacherFormData = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  salary: '',
  percentage: '',
  notes: '',
  status: 'active',
};

const dayNames: Record<string, string> = {
  '1': 'الأحد',
  '2': 'الإثنين',
  '3': 'الثلاثاء',
  '4': 'الأربعاء',
  '5': 'الخميس',
  '6': 'الجمعة',
  '7': 'السبت',
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function getAvatarColor(name: string): string {
  const colors = [
    'bg-emerald-600',
    'bg-teal-600',
    'bg-cyan-600',
    'bg-sky-600',
    'bg-violet-600',
    'bg-purple-600',
    'bg-rose-600',
    'bg-orange-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── Component ───────────────────────────────────────────────────────────

export function TeachersView() {
  const { setCurrentView } = useAppStore();

  // ── Data states ──
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ── Dialog states ──
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [detailTeacher, setDetailTeacher] = useState<Teacher | null>(null);

  // ── Form state ──
  const [form, setForm] = useState<TeacherFormData>(emptyForm);
  const [subjectAssignments, setSubjectAssignments] = useState<SubjectAssignment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  // ── Group students by teacherId ──
  const studentCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      if (s.teacherId) {
        map.set(s.teacherId, (map.get(s.teacherId) || 0) + 1);
      }
    });
    return map;
  }, [students]);

  const getStudentsForTeacher = useCallback(
    (teacherId: string) => {
      return students.filter((s) => s.teacherId === teacherId);
    },
    [students]
  );

  // ── Fetch data ──
  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error('فشل');
      const data = await res.json();
      setTeachers(data);
    } catch {
      toast.error('فشل في تحميل قائمة الأساتذة');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students');
      if (!res.ok) throw new Error('فشل');
      const data = await res.json();
      setStudents(data);
    } catch {
      // Silent fail – student count just won't show
    }
  }, []);

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

  useEffect(() => {
    fetchTeachers();
    fetchStudents();
    fetchServices();
  }, [fetchTeachers, fetchStudents, fetchServices]);

  // ── Filtered teachers ──
  const filteredTeachers = teachers.filter((t) => {
    const matchSearch = !search || t.fullName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Stats ──
  const totalTeachers = teachers.length;
  const activeTeachers = teachers.filter((t) => t.status === 'active').length;
  const totalStudents = students.length;

  // ── Form handlers ──
  const openCreateDialog = () => {
    setEditingTeacher(null);
    setForm(emptyForm);
    setSubjectAssignments([]);
    setExpandedServices(new Set());
    setFormOpen(true);
  };

  const openEditDialog = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setForm({
      fullName: teacher.fullName,
      phone: teacher.phone,
      email: teacher.email,
      address: teacher.address,
      salary: teacher.salary ? String(teacher.salary) : '',
      percentage: teacher.percentage ? String(teacher.percentage) : '',
      notes: teacher.notes || '',
      status: teacher.status,
    });
    const assignments: SubjectAssignment[] = teacher.subjects.map((ts) => ({
      subjectId: ts.subjectId,
      levelIds: ts.subject.levels?.map((l) => l.id) || [],
    }));
    setSubjectAssignments(assignments);
    const assignedIds = new Set(teacher.subjects.map((ts) => ts.subjectId));
    const expanded = new Set<string>();
    services.forEach((s) => {
      if (s.subjects.some((sub) => assignedIds.has(sub.id))) expanded.add(s.id);
    });
    setExpandedServices(expanded);
    setFormOpen(true);
  };

  const openDetailDialog = (teacher: Teacher) => {
    setDetailTeacher(teacher);
    setDetailOpen(true);
  };

  const toggleSubjectAssignment = (subjectId: string, subject: Subject) => {
    const existing = subjectAssignments.find((a) => a.subjectId === subjectId);
    if (existing) {
      setSubjectAssignments((prev) => prev.filter((a) => a.subjectId !== subjectId));
    } else {
      setSubjectAssignments((prev) => [
        ...prev,
        { subjectId, levelIds: subject.levels.map((l) => l.id) },
      ]);
    }
  };

  const toggleLevelInAssignment = (subjectId: string, levelId: string) => {
    setSubjectAssignments((prev) =>
      prev.map((a) => {
        if (a.subjectId !== subjectId) return a;
        const has = a.levelIds.includes(levelId);
        return {
          ...a,
          levelIds: has ? a.levelIds.filter((id) => id !== levelId) : [...a.levelIds, levelId],
        };
      })
    );
  };

  const isSubjectAssigned = (subjectId: string) =>
    subjectAssignments.some((a) => a.subjectId === subjectId);

  const getAssignedLevels = (subjectId: string) =>
    subjectAssignments.find((a) => a.subjectId === subjectId)?.levelIds || [];

  const toggleServiceExpand = (serviceId: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      toast.error('يرجى إدخال اسم الأستاذ');
      return;
    }
    setSubmitting(true);
    try {
      const body: any = {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        address: form.address,
        salary: parseFloat(form.salary) || 0,
        percentage: parseFloat(form.percentage) || 0,
        notes: form.notes,
        status: form.status,
        subjects: subjectAssignments.map((a) => ({
          subjectId: a.subjectId,
          levelIds: a.levelIds.join(','),
        })),
      };
      const url = editingTeacher ? `/api/teachers/${editingTeacher.id}` : '/api/teachers';
      const method = editingTeacher ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('فشل');
      toast.success(editingTeacher ? 'تم تحديث بيانات الأستاذ بنجاح' : 'تم إضافة الأستاذ بنجاح');
      setFormOpen(false);
      fetchTeachers();
      fetchStudents();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTeacher) return;
    try {
      const res = await fetch(`/api/teachers/${deletingTeacher.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل');
      toast.success('تم حذف الأستاذ بنجاح');
      setDeleteOpen(false);
      setDeletingTeacher(null);
      fetchTeachers();
      fetchStudents();
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">إدارة الأساتذة</h2>
          <p className="text-sm text-muted-foreground mt-1">
            عرض وإدارة بيانات الأساتذة وتعيينات المواد والتلاميذ
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة أستاذ
        </Button>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalTeachers}</p>
              <p className="text-xs text-muted-foreground">إجمالي الأساتذة</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeTeachers}</p>
              <p className="text-xs text-muted-foreground">أساتذة نشطون</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">إجمالي التلاميذ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 w-full sm:max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث بالاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <div className="flex gap-2">
              {([
                { value: 'all' as StatusFilter, label: 'الكل' },
                { value: 'active' as StatusFilter, label: 'نشط' },
                { value: 'inactive' as StatusFilter, label: 'غير نشط' },
              ]).map((tab) => (
                <Button
                  key={tab.value}
                  variant={statusFilter === tab.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Loading State ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-14" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-10" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTeachers.length === 0 ? (
        /* ── Empty State ── */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">لا يوجد أساتذة</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || statusFilter !== 'all'
                ? 'لا توجد نتائج مطابقة لمعايير البحث'
                : 'ابدأ بإضافة أستاذ جديد'}
            </p>
          </CardContent>
        </Card>
      ) : (
        /* ── Teacher Cards Grid ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher) => {
            const studentCount = studentCountsMap.get(teacher.id) || 0;
            const avatarColor = getAvatarColor(teacher.fullName);

            return (
              <Card
                key={teacher.id}
                className="hover:shadow-lg transition-all duration-200 cursor-pointer group border-border/60"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md',
                          teacher.status === 'active' ? avatarColor : 'bg-gray-400'
                        )}
                      >
                        {teacher.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate leading-tight">
                          {teacher.fullName}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              teacher.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100'
                            )}
                          >
                            {teacher.status === 'active' ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {teacher.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span dir="ltr" className="truncate">{teacher.phone}</span>
                      </div>
                    )}
                    {teacher.email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{teacher.email}</span>
                      </div>
                    )}
                    {teacher.percentage > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Wallet className="h-3 w-3 shrink-0 text-amber-500" />
                        <span>{teacher.percentage}%</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <BookOpen className="h-3 w-3 shrink-0 text-primary" />
                      <span>{teacher.subjects.length} مادة</span>
                    </div>
                  </div>

                  {/* Student Count Badge - PROMINENT */}
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                      studentCount > 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                    )}
                  >
                    <Users className="h-4 w-4" />
                    <span>عدد التلاميذ: {studentCount}</span>
                  </div>

                  {/* Subject Badges */}
                  {teacher.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjects.slice(0, 3).map((ts) => (
                        <Badge
                          key={ts.id}
                          variant="outline"
                          className="text-[10px] font-normal px-1.5 py-0"
                        >
                          {ts.subject.nameAr || ts.subject.name}
                        </Badge>
                      ))}
                      {teacher.subjects.length > 3 && (
                        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                          +{teacher.subjects.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <Separator className="my-1" />

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 flex-1 text-xs h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetailDialog(teacher);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      التفاصيل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 flex-1 text-xs h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(teacher);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      تعديل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingTeacher(teacher);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── Add / Edit Dialog ──────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingTeacher ? 'تعديل بيانات الأستاذ' : 'إضافة أستاذ جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingTeacher
                ? 'قم بتعديل بيانات الأستاذ وتعيينات المواد'
                : 'أدخل بيانات الأستاذ الجديد وقم بتعيين المواد'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="space-y-6 py-4">
              {/* Personal Info */}
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <UserCheck className="h-4 w-4 text-primary" />
                  المعلومات الشخصية
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="fullName">الاسم الكامل *</Label>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="أدخل الاسم الكامل"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">الهاتف</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="رقم الهاتف"
                      dir="ltr"
                      className="text-left"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="البريد الإلكتروني"
                      dir="ltr"
                      className="text-left"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="address">العنوان</Label>
                    <Input
                      id="address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="العنوان"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Financial Info */}
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Wallet className="h-4 w-4 text-amber-500" />
                  المعلومات المالية
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="salary">الراتب (درهم)</Label>
                    <Input
                      id="salary"
                      type="number"
                      value={form.salary}
                      onChange={(e) => setForm({ ...form, salary: e.target.value })}
                      placeholder="0"
                      dir="ltr"
                      className="text-left"
                    />
                  </div>
                  <div>
                    <Label htmlFor="percentage">النسبة المئوية %</Label>
                    <Input
                      id="percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={form.percentage}
                      onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                      placeholder="0"
                      dir="ltr"
                      className="text-left"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Status & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>الحالة</Label>
                  <Select
                    value={form.status}
                    onValueChange={(val: 'active' | 'inactive') =>
                      setForm({ ...form, status: val })
                    }
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="inactive">غير نشط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="ملاحظات إضافية..."
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Subject Assignments */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <Label className="text-base font-semibold">تعيين المواد</Label>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  اختر المواد التي يدرسها هذا الأستاذ
                </p>

                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    لا توجد خدمات متاحة. قم بإضافة خدمات أولاً.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto rounded-lg border p-3">
                    {services.map((service) => {
                      const isExpanded = expandedServices.has(service.id);
                      const serviceHasAssigned = service.subjects.some((s) =>
                        isSubjectAssigned(s.id)
                      );
                      const assignedCount = service.subjects.filter((s) =>
                        isSubjectAssigned(s.id)
                      ).length;

                      return (
                        <div key={service.id} className="border rounded-lg overflow-hidden">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                            onClick={() => toggleServiceExpand(service.id)}
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium text-sm">
                                {service.nameAr || service.name}
                              </span>
                              {serviceHasAssigned && (
                                <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                                  {assignedCount} مُعين
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {service.subjects.length} مادة
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
                              {service.subjects.map((subject) => {
                                const assigned = isSubjectAssigned(subject.id);
                                const assignedLevels = getAssignedLevels(subject.id);

                                return (
                                  <div key={subject.id} className="border rounded-md p-2.5 bg-background">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={assigned}
                                        onCheckedChange={() =>
                                          toggleSubjectAssignment(subject.id, subject)
                                        }
                                      />
                                      <span className="text-sm font-medium">
                                        {subject.nameAr || subject.name}
                                      </span>
                                    </div>

                                    {assigned && subject.levels.length > 0 && (
                                      <div className="mt-2 mr-6 space-y-1.5">
                                        <p className="text-xs text-muted-foreground">المستويات:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {subject.levels.map((level) => {
                                            const isChecked = assignedLevels.includes(level.id);
                                            return (
                                              <label
                                                key={level.id}
                                                className={cn(
                                                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors border select-none',
                                                  isChecked
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
                                                )}
                                              >
                                                <Checkbox
                                                  checked={isChecked}
                                                  onCheckedChange={() =>
                                                    toggleLevelInAssignment(subject.id, level.id)
                                                  }
                                                  className="sr-only"
                                                />
                                                {level.nameAr || level.name}
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? 'جاري الحفظ...'
                : editingTeacher
                  ? 'تحديث البيانات'
                  : 'إضافة الأستاذ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── Delete Confirmation ────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الأستاذ &quot;{deletingTeacher?.fullName}&quot;؟ لا يمكن
              التراجع عن هذا الإجراء.
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── Teacher Detail Dialog ──────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg shadow-md">
                {detailTeacher?.fullName.charAt(0)}
              </div>
              <div>
                <div>{detailTeacher?.fullName}</div>
                <Badge
                  className={cn(
                    'mt-1 text-[10px] px-1.5 py-0',
                    detailTeacher?.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100'
                  )}
                >
                  {detailTeacher?.status === 'active' ? 'نشط' : 'غير نشط'}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {detailTeacher && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 pb-4">
                {/* Contact Info */}
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    معلومات الاتصال
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border p-3 bg-muted/20">
                    {detailTeacher.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span dir="ltr">{detailTeacher.phone}</span>
                      </div>
                    )}
                    {detailTeacher.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{detailTeacher.email}</span>
                      </div>
                    )}
                    {detailTeacher.address && (
                      <div className="flex items-center gap-2 text-sm sm:col-span-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{detailTeacher.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Financial Info */}
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-amber-500" />
                    المعلومات المالية
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">الراتب</p>
                      <p className="font-bold text-lg">
                        {detailTeacher.salary || 0}{' '}
                        <span className="text-xs font-normal text-muted-foreground">درهم</span>
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">النسبة المئوية</p>
                      <p className="font-bold text-lg text-primary">
                        {detailTeacher.percentage || 0}%
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* ── Students Assigned to Teacher ── */}
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600" />
                    التلاميذ المعينون (
                    {studentCountsMap.get(detailTeacher.id) || 0})
                  </h4>
                  {(() => {
                    const teacherStudents = getStudentsForTeacher(detailTeacher.id);
                    if (teacherStudents.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg">
                          لا يوجد تلاميذ معينون لهذا الأستاذ
                        </p>
                      );
                    }
                    return (
                      <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-lg border">
                        {teacherStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            className="w-full flex items-center gap-3 p-3 hover:bg-muted/60 transition-colors text-right"
                            onClick={() => {
                              setDetailOpen(false);
                              setCurrentView('students');
                            }}
                          >
                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                              {student.fullName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{student.fullName}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                {student.phone && (
                                  <span className="flex items-center gap-1" dir="ltr">
                                    <Phone className="h-3 w-3" />
                                    {student.phone}
                                  </span>
                                )}
                                {student.level && (
                                  <span className="flex items-center gap-1">
                                    <GraduationCap className="h-3 w-3" />
                                    {student.level.nameAr}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <Separator />

                {/* Assigned Subjects */}
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    المواد المعينة ({detailTeacher.subjects.length})
                  </h4>
                  {detailTeacher.subjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg">
                      لا توجد مواد معينة
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {detailTeacher.subjects.map((ts) => (
                        <div key={ts.id} className="border rounded-lg p-3">
                          <span className="font-medium text-sm">
                            {ts.subject.nameAr || ts.subject.name}
                          </span>
                          {ts.subject.levels && ts.subject.levels.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {ts.subject.levels.map((level) => (
                                <Badge
                                  key={level.id}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {level.nameAr || level.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Schedule */}
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    جدول الحصص ({detailTeacher.schedules?.length || 0})
                  </h4>
                  {!detailTeacher.schedules || detailTeacher.schedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg">
                      لا توجد حصص مبرمجة
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {detailTeacher.schedules.map((sched: any) => (
                        <div
                          key={sched.id}
                          className="border rounded-lg p-3 flex flex-wrap items-center gap-3"
                        >
                          <div className="flex items-center gap-1.5 text-sm">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">
                              {dayNames[sched.dayOfWeek] || sched.dayOfWeek}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span dir="ltr">
                              {sched.startTime} - {sched.endTime}
                            </span>
                          </div>
                          {sched.classroom && (
                            <Badge variant="outline" className="text-xs">
                              {sched.classroom.nameAr || sched.classroom.name}
                            </Badge>
                          )}
                          {sched.subject && (
                            <Badge variant="secondary" className="text-xs">
                              {sched.subject.nameAr || sched.subject.name}
                            </Badge>
                          )}
                          {sched.level && (
                            <Badge variant="outline" className="text-xs">
                              {sched.level.nameAr || sched.level.name}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Payment History */}
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-amber-500" />
                    سجل المدفوعات ({detailTeacher.payments?.length || 0})
                  </h4>
                  {!detailTeacher.payments || detailTeacher.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg">
                      لا توجد مدفوعات
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {detailTeacher.payments.map((pay: any) => (
                        <div
                          key={pay.id}
                          className="flex items-center justify-between border rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">
                              {pay.amount || 0} درهم
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {pay.paymentDate
                              ? new Date(pay.paymentDate).toLocaleDateString('ar-MA')
                              : '—'}
                          </div>
                          {pay.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {pay.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {detailTeacher.notes && (
                  <>
                    <Separator />
                    <div className="space-y-2.5">
                      <h4 className="font-semibold text-sm">ملاحظات</h4>
                      <p className="text-sm text-muted-foreground border rounded-lg p-3 whitespace-pre-wrap">
                        {detailTeacher.notes}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
