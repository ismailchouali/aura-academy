'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Phone,
  Mail,
  UserCheck,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Layers,
  UserCog,
  ClipboardList,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface LevelItem {
  id: string;
  name: string;
  nameAr: string;
}

interface SubjectItem {
  id: string;
  name: string;
  nameAr: string;
  levels: LevelItem[];
}

interface ServiceItem {
  id: string;
  name: string;
  nameAr: string;
  subjects: SubjectItem[];
}

interface TeacherItem {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  subjects: {
    subjectId: string;
    subject: {
      id: string;
      name: string;
      nameAr: string;
    };
  }[];
}

interface Student {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  levelId: string | null;
  level: {
    id: string;
    name: string;
    nameAr: string;
    subject: { name: string; nameAr: string; service?: { nameAr: string } };
  } | null;
  teacherId: string | null;
  teacher: { id: string; fullName: string } | null;
  parentName: string | null;
  parentPhone: string | null;
  status: string;
  enrollmentDate: string;
  payments: unknown[];
}

type WizardStep = 'service' | 'subject' | 'level' | 'teacher' | 'info';

interface WizardState {
  step: WizardStep;
  serviceId: string;
  subjectId: string;
  levelId: string;
  teacherId: string;
  // Personal info
  fullName: string;
  phone: string;
  email: string;
  address: string;
  parentName: string;
  parentPhone: string;
}

const initialWizard: WizardState = {
  step: 'service',
  serviceId: '',
  subjectId: '',
  levelId: '',
  teacherId: '',
  fullName: '',
  phone: '',
  email: '',
  address: '',
  parentName: '',
  parentPhone: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────

const STEP_ORDER: WizardStep[] = ['service', 'subject', 'level', 'teacher', 'info'];

function stepIndex(step: WizardStep): number {
  return STEP_ORDER.indexOf(step);
}

function getStepLabel(step: WizardStep): string {
  switch (step) {
    case 'service': return 'الخدمة';
    case 'subject': return 'المادة';
    case 'level': return 'المستوى';
    case 'teacher': return 'الأستاذ';
    case 'info': return 'المعلومات الشخصية';
  }
}

function getStepIcon(step: WizardStep) {
  switch (step) {
    case 'service': return <BookOpen className="h-4 w-4" />;
    case 'subject': return <Layers className="h-4 w-4" />;
    case 'level': return <GraduationCap className="h-4 w-4" />;
    case 'teacher': return <UserCog className="h-4 w-4" />;
    case 'info': return <ClipboardList className="h-4 w-4" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">نشط</Badge>;
    case 'inactive':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">غير نشط</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function StudentsView() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);

  // Dialog & wizard
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [wizard, setWizard] = useState<WizardState>(initialWizard);
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchStudents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/students?${params.toString()}`);
      if (!res.ok) throw new Error('فشل في تحميل التلاميذ');
      const json = await res.json();
      setStudents(json);
    } catch {
      toast.error('فشل في تحميل قائمة التلاميذ');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setServices(json);
    } catch {
      console.error('Failed to fetch services');
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTeachers(json);
    } catch {
      console.error('Failed to fetch teachers');
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchServices();
    fetchTeachers();
  }, [fetchServices, fetchTeachers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchStudents();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Derived data for wizard ────────────────────────────────────────────

  const selectedService = services.find((s) => s.id === wizard.serviceId);
  const selectedSubject = selectedService?.subjects.find((s) => s.id === wizard.subjectId);
  const selectedLevel = selectedSubject?.levels.find((l) => l.id === wizard.levelId);

  // Teachers who teach the selected subject
  const subjectTeachers = teachers.filter((t) =>
    t.status === 'active' &&
    t.subjects.some((ts) => ts.subjectId === wizard.subjectId)
  );

  // Count students per teacher
  const teacherStudentCount: Record<string, number> = {};
  students.forEach((s) => {
    if (s.teacherId) {
      teacherStudentCount[s.teacherId] = (teacherStudentCount[s.teacherId] || 0) + 1;
    }
  });

  // ── Wizard navigation ──────────────────────────────────────────────────

  const goNext = () => {
    const idx = stepIndex(wizard.step);
    if (idx < STEP_ORDER.length - 1) {
      setWizard((prev) => ({ ...prev, step: STEP_ORDER[idx + 1] }));
    }
  };

  const goPrev = () => {
    const idx = stepIndex(wizard.step);
    if (idx > 0) {
      setWizard((prev) => ({ ...prev, step: STEP_ORDER[idx - 1] }));
    }
  };

  const canGoNext = (): boolean => {
    switch (wizard.step) {
      case 'service': return !!wizard.serviceId;
      case 'subject': return !!wizard.subjectId;
      case 'level': return !!wizard.levelId;
      case 'teacher': return true; // teacher is optional
      case 'info': return !!wizard.fullName.trim();
      default: return false;
    }
  };

  // ── Dialog open / close ───────────────────────────────────────────────

  const handleOpenDialog = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      // Pre-fill wizard based on student's level
      let serviceId = '';
      let subjectId = '';
      if (student.level) {
        // Find the subject this level belongs to
        for (const svc of services) {
          for (const subj of svc.subjects) {
            if (subj.levels.some((l) => l.id === student.levelId)) {
              serviceId = svc.id;
              subjectId = subj.id;
              break;
            }
          }
          if (serviceId) break;
        }
      }
      setWizard({
        step: 'info',
        serviceId,
        subjectId,
        levelId: student.levelId || '',
        teacherId: student.teacherId || '',
        fullName: student.fullName,
        phone: student.phone || '',
        email: student.email || '',
        address: student.address || '',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
      });
    } else {
      setEditingStudent(null);
      setWizard({ ...initialWizard });
    }
    setDialogOpen(true);
  };

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!wizard.fullName.trim()) {
      toast.error('يرجى إدخال اسم التلميذ');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        fullName: wizard.fullName.trim(),
        phone: wizard.phone || null,
        email: wizard.email || null,
        address: wizard.address || null,
        levelId: wizard.levelId || null,
        teacherId: wizard.teacherId || null,
        parentName: wizard.parentName || null,
        parentPhone: wizard.parentPhone || null,
        enrollmentDate: new Date().toISOString(),
        status: 'active',
      };

      const url = editingStudent ? `/api/students/${editingStudent.id}` : '/api/students';
      const method = editingStudent ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('فشل في حفظ البيانات');
      toast.success(editingStudent ? 'تم تحديث بيانات التلميذ بنجاح' : 'تم إضافة التلميذ بنجاح');
      setDialogOpen(false);
      fetchStudents();
    } catch {
      toast.error('فشل في حفظ البيانات');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('تم حذف التلميذ بنجاح');
      fetchStudents();
    } catch {
      toast.error('فشل في حذف التلميذ');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Toggle status ─────────────────────────────────────────────────────

  const handleToggleStatus = async (student: Student) => {
    const newStatus = student.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: student.fullName,
          phone: student.phone,
          email: student.email,
          address: student.address,
          levelId: student.levelId,
          teacherId: student.teacherId,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          status: newStatus,
          enrollmentDate: student.enrollmentDate,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === 'active' ? 'تم تفعيل التلميذ' : 'تم تعطيل التلميذ');
      fetchStudents();
    } catch {
      toast.error('فشل في تحديث الحالة');
    }
  };

  // ── Render wizard steps ───────────────────────────────────────────────

  const renderWizardStep = () => {
    switch (wizard.step) {
      // ── Step 1: Choose Service ─────────────────────────────────────────
      case 'service':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">اختر نوع الخدمة</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {services.map((svc) => (
                <Card
                  key={svc.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md border-2',
                    wizard.serviceId === svc.id
                      ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                      : 'border-transparent hover:border-teal-200'
                  )}
                  onClick={() => {
                    setWizard((prev) => ({
                      ...prev,
                      serviceId: svc.id,
                      subjectId: '',
                      levelId: '',
                      teacherId: '',
                    }));
                    setTimeout(() => goNext(), 150);
                  }}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                      wizard.serviceId === svc.id ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-700'
                    )}>
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{svc.nameAr}</p>
                      <p className="text-xs text-muted-foreground">{svc.subjects.length} مادة</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      // ── Step 2: Choose Subject ────────────────────────────────────────
      case 'subject':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="bg-teal-50 border-teal-200 text-teal-700">
                {selectedService?.nameAr}
              </Badge>
              <span className="text-muted-foreground">اختر المادة</span>
            </div>
            {selectedService?.subjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>لا توجد مواد في هذه الخدمة</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                {selectedService?.subjects.map((subj) => (
                  <Card
                    key={subj.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md border-2',
                      wizard.subjectId === subj.id
                        ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                        : 'border-transparent hover:border-amber-200'
                    )}
                    onClick={() => {
                      setWizard((prev) => ({
                        ...prev,
                        subjectId: subj.id,
                        levelId: '',
                        teacherId: '',
                      }));
                      setTimeout(() => goNext(), 150);
                    }}
                  >
                    <CardContent className="p-3 text-center">
                      <Layers className={cn(
                        'h-5 w-5 mx-auto mb-1',
                        wizard.subjectId === subj.id ? 'text-amber-600' : 'text-muted-foreground'
                      )} />
                      <p className="font-medium text-sm">{subj.nameAr}</p>
                      <p className="text-xs text-muted-foreground">{subj.levels.length} مستوى</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      // ── Step 3: Choose Level ──────────────────────────────────────────
      case 'level':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <Badge variant="outline" className="bg-teal-50 border-teal-200 text-teal-700">
                {selectedService?.nameAr}
              </Badge>
              <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                {selectedSubject?.nameAr}
              </Badge>
              <span className="text-muted-foreground">اختر المستوى</span>
            </div>
            {selectedSubject?.levels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>لا توجد مستويات في هذه المادة</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                {selectedSubject?.levels.map((lvl) => (
                  <Card
                    key={lvl.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md border-2',
                      wizard.levelId === lvl.id
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                        : 'border-transparent hover:border-indigo-200'
                    )}
                    onClick={() => {
                      setWizard((prev) => ({
                        ...prev,
                        levelId: lvl.id,
                        teacherId: '',
                      }));
                      setTimeout(() => goNext(), 150);
                    }}
                  >
                    <CardContent className="p-3 text-center">
                      <GraduationCap className={cn(
                        'h-5 w-5 mx-auto mb-1',
                        wizard.levelId === lvl.id ? 'text-indigo-600' : 'text-muted-foreground'
                      )} />
                      <p className="font-medium text-sm">{lvl.nameAr}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      // ── Step 4: Choose Teacher ────────────────────────────────────────
      case 'teacher':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <Badge variant="outline" className="bg-teal-50 border-teal-200 text-teal-700">
                {selectedService?.nameAr}
              </Badge>
              <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                {selectedSubject?.nameAr}
              </Badge>
              <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">
                {selectedLevel?.nameAr}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">اختر الأستاذ (اختياري)</p>
            {subjectTeachers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCog className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>لا يوجد أساتذة مسجلين لهذه المادة حالياً</p>
                <p className="text-xs mt-1">يمكنك إضافة التلميذ بدون أستاذ</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                <Card
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md border-2',
                    wizard.teacherId === ''
                      ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                      : 'border-transparent hover:border-teal-200'
                  )}
                  onClick={() => {
                    setWizard((prev) => ({ ...prev, teacherId: '' }));
                    setTimeout(() => goNext(), 150);
                  }}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                      wizard.teacherId === '' ? 'bg-teal-500 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      <span className="text-sm">—</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">بدون أستاذ</p>
                      <p className="text-xs text-muted-foreground">تخطي اختيار الأستاذ</p>
                    </div>
                  </CardContent>
                </Card>
                {subjectTeachers.map((t) => (
                  <Card
                    key={t.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md border-2',
                      wizard.teacherId === t.id
                        ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                        : 'border-transparent hover:border-teal-200'
                    )}
                    onClick={() => {
                      setWizard((prev) => ({ ...prev, teacherId: t.id }));
                      setTimeout(() => goNext(), 150);
                    }}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={cn(
                        'h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                        wizard.teacherId === t.id ? 'bg-teal-500 text-white' : 'bg-muted text-muted-foreground'
                      )}>
                        {t.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t.fullName}</p>
                        {t.phone && (
                          <p className="text-xs text-muted-foreground" dir="ltr">{t.phone}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {teacherStudentCount[t.id] || 0} تلميذ
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={goNext}>
                تخطي
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          </div>
        );

      // ── Step 5: Personal Info ─────────────────────────────────────────
      case 'info':
        return (
          <div className="space-y-4">
            {/* Summary of chosen path */}
            <div className="bg-gradient-to-l from-teal-50 to-amber-50 rounded-lg p-3 border">
              <p className="text-xs text-muted-foreground mb-2 font-medium">ملخص التسجيل</p>
              <div className="flex flex-wrap gap-2">
                {selectedService && (
                  <Badge className="bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100">
                    <BookOpen className="h-3 w-3 ml-1" />{selectedService.nameAr}
                  </Badge>
                )}
                {selectedSubject && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                    <Layers className="h-3 w-3 ml-1" />{selectedSubject.nameAr}
                  </Badge>
                )}
                {selectedLevel && (
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
                    <GraduationCap className="h-3 w-3 ml-1" />{selectedLevel.nameAr}
                  </Badge>
                )}
                {wizard.teacherId && (() => {
                  const t = teachers.find((tr) => tr.id === wizard.teacherId);
                  return t ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                      <UserCog className="h-3 w-3 ml-1" />{t.fullName}
                    </Badge>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Personal Info Fields */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                المعلومات الشخصية
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">الاسم الكامل *</Label>
                  <Input
                    id="fullName"
                    value={wizard.fullName}
                    onChange={(e) => setWizard((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder="الاسم الكامل للتلميذ"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">الهاتف</Label>
                  <Input
                    id="phone"
                    value={wizard.phone}
                    onChange={(e) => setWizard((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="رقم الهاتف"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={wizard.email}
                    onChange={(e) => setWizard((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="البريد الإلكتروني"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="enrollmentDate">تاريخ التسجيل</Label>
                  <Input
                    id="enrollmentDate"
                    type="date"
                    value={editingStudent?.enrollmentDate?.split('T')[0] || new Date().toISOString().split('T')[0]}
                    disabled
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address">العنوان</Label>
                  <Input
                    id="address"
                    value={wizard.address}
                    onChange={(e) => setWizard((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="عنوان السكن"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                معلومات الولي
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="parentName">اسم الولي</Label>
                  <Input
                    id="parentName"
                    value={wizard.parentName}
                    onChange={(e) => setWizard((prev) => ({ ...prev, parentName: e.target.value }))}
                    placeholder="اسم ولي الأمر"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="parentPhone">هاتف الولي</Label>
                  <Input
                    id="parentPhone"
                    value={wizard.parentPhone}
                    onChange={(e) => setWizard((prev) => ({ ...prev, parentPhone: e.target.value }))}
                    placeholder="رقم هاتف ولي الأمر"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-5 w-5" />
          <span className="text-sm">{students.length} تلميذ</span>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة تلميذ
        </Button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setLoading(true); }}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث عن تلميذ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9"
                />
              </div>
              <TabsList>
                <TabsTrigger value="all">الكل</TabsTrigger>
                <TabsTrigger value="active">نشط</TabsTrigger>
                <TabsTrigger value="inactive">غير نشط</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <TableSkeleton />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">لا يوجد تلاميذ</p>
              <p className="text-sm mt-1">اضغط على &quot;إضافة تلميذ&quot; لإضافة تلميذ جديد</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم الكامل</TableHead>
                    <TableHead className="text-right hidden md:table-cell">المستوى</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">الأستاذ</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الهاتف</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">التسجيل</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium text-right">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {student.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{student.fullName}</p>
                            {student.email && (
                              <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {student.level ? (
                          <div className="text-sm">
                            <span className="text-muted-foreground">{student.level.subject?.nameAr}</span>
                            <span className="mx-1">—</span>
                            <span className="font-medium">{student.level.nameAr}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        {student.teacher ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold shrink-0">
                              {student.teacher.fullName.charAt(0)}
                            </div>
                            <span>{student.teacher.fullName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {student.phone || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={student.status === 'active'}
                            onCheckedChange={() => handleToggleStatus(student)}
                          />
                          {getStatusBadge(student.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-sm">
                        {student.enrollmentDate
                          ? new Date(student.enrollmentDate).toLocaleDateString('ar-MA')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(student)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog open={deletingId === student.id} onOpenChange={(open) => setDeletingId(open ? student.id : null)}>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من حذف التلميذ &quot;{student.fullName}&quot;؟ لا يمكن التراجع عن هذا الإجراء.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(student.id)}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          ADD / EDIT DIALOG WITH STEPPED WIZARD
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingStudent ? 'تعديل بيانات التلميذ' : 'إضافة تلميذ جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingStudent ? 'قم بتعديل بيانات التلميذ أدناه' : 'اتبع الخطوات لإضافة تلميذ جديد'}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-between px-7 pb-2 shrink-0">
            {STEP_ORDER.map((s, i) => {
              const currentIdx = stepIndex(wizard.step);
              const isActive = i === currentIdx;
              const isCompleted = i < currentIdx;

              return (
                <div key={s} className="flex items-center gap-1">
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors',
                      isActive && 'bg-primary text-primary-foreground',
                      isCompleted && 'bg-primary/10 text-primary',
                      !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                    )}
                    onClick={() => {
                      // Allow clicking back to completed steps, but only forward if current is completed
                      if (i < currentIdx) {
                        setWizard((prev) => ({ ...prev, step: s }));
                      }
                    }}
                    disabled={!isActive && !isCompleted}
                  >
                    {getStepIcon(s)}
                    <span className="hidden sm:inline">{getStepLabel(s)}</span>
                    <span className="sm:hidden">{i + 1}</span>
                  </button>
                  {i < STEP_ORDER.length - 1 && (
                    <ChevronLeft className="h-3 w-3 text-muted-foreground mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="min-h-[280px]">
              {renderWizardStep()}
            </div>
          </div>

          {/* Navigation buttons */}
          <DialogFooter className="flex-row gap-2 sm:justify-between px-6 py-4 border-t shrink-0">
            <div className="flex gap-2">
              {stepIndex(wizard.step) > 0 && !editingStudent && (
                <Button variant="outline" size="sm" onClick={goPrev}>
                  <ChevronRight className="h-4 w-4 ml-1" />
                  السابق
                </Button>
              )}
              {editingStudent && (
                <Button variant="outline" size="sm" onClick={() => goPrev()}>
                  <ChevronRight className="h-4 w-4 ml-1" />
                  السابق
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                إلغاء
              </Button>
              {wizard.step === 'info' ? (
                <Button onClick={handleSubmit} disabled={submitting || !wizard.fullName.trim()}>
                  {submitting ? 'جاري الحفظ...' : editingStudent ? 'تحديث' : 'إضافة'}
                </Button>
              ) : (
                <Button onClick={goNext} disabled={!canGoNext()}>
                  التالي
                  <ChevronLeft className="h-4 w-4 mr-1" />
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
