'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useT } from '@/hooks/use-translation';
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
  UserCheck,
  GraduationCap,
  Wallet,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Layers,
  UserMinus,
  Sparkles,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

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
    subject: { name: string; nameAr: string; service?: { id: string; nameAr: string } };
  } | null;
  teacherId: string | null;
  teacher: { id: string; fullName: string } | null;
  parentName: string | null;
  parentPhone: string | null;
  monthlyFee: number;
  packMonths?: number;
  status: string;
  enrollmentDate: string;
  payments: unknown[];
}

interface Service {
  id: string;
  name: string;
  nameAr: string;
  nameFr: string;
  description: string | null;
  icon: string | null;
  order: number;
  subjects: Subject[];
}

interface Subject {
  id: string;
  name: string;
  nameAr: string;
  nameFr: string;
  levels: Level[];
  order: number;
}

interface Level {
  id: string;
  name: string;
  nameAr: string;
  nameFr: string;
}

interface Teacher {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
  subjects: {
    id: string;
    teacherId: string;
    subjectId: string;
    subject: { id: string; name: string; nameAr: string };
  }[];
}

interface FormState {
  fullName: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  monthlyFee: string;
  packMonths: number;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const initialForm: FormState = {
  fullName: '',
  phone: '',
  parentName: '',
  parentPhone: '',
  monthlyFee: '',
  packMonths: 1,
};

// ── Service icons map ──────────────────────────────────────────────────────

const serviceIcons: Record<string, React.ElementType> = {
  'Cours de Soutiens': GraduationCap,
  'Langues': BookOpen,
  'Informatique': Sparkles,
  'Préparation Concours': Layers,
};

// ── Color helpers ──────────────────────────────────────────────────────────

function getAvatarColor(name: string): string {
  const colors = [
    'bg-teal-100 text-teal-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-cyan-100 text-cyan-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── Component ──────────────────────────────────────────────────────────────

export function StudentsView() {
  const t = useT();

  // ── Data state ──────────────────────────────────────────────────────────
  const [students, setStudents] = useState<Student[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Wizard state ────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [noTeacher, setNoTeacher] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // ── Ref for fullName input (auto-focus only once on step 5) ─────────────
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const prevStepRef = useRef<WizardStep>(1);

  useEffect(() => {
    if (wizardStep === 5 && prevStepRef.current !== 5) {
      // Only focus when transitioning TO step 5, not on re-renders
      setTimeout(() => fullNameInputRef.current?.focus(), 100);
    }
    prevStepRef.current = wizardStep;
  }, [wizardStep]);

  // ── Delete state ────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Computed: student count per teacher ─────────────────────────────────
  const studentCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of students) {
      if (s.teacherId) {
        map[s.teacherId] = (map[s.teacherId] || 0) + 1;
      }
    }
    return map;
  }, [students]);

  // ── Computed: filtered subjects for step 2 ─────────────────────────────
  const filteredSubjects = useMemo(() => {
    if (!selectedService) return [];
    return selectedService.subjects || [];
  }, [selectedService]);

  // ── Computed: filtered levels for step 3 (deduplicated by name) ───────
  const filteredLevels = useMemo(() => {
    if (!selectedSubject) return [];
    const levels = selectedSubject.levels || [];
    // Deduplicate by name in case of duplicate DB entries
    const seen = new Map<string, Level>();
    for (const lvl of levels) {
      if (!seen.has(lvl.name)) {
        seen.set(lvl.name, lvl);
      }
    }
    return Array.from(seen.values());
  }, [selectedSubject]);

  // ── Computed: filtered teachers for step 4 ─────────────────────────────
  const filteredTeachers = useMemo(() => {
    if (!selectedSubject) return [];
    return teachers.filter(
      (teacher) =>
        teacher.status === 'active' &&
        teacher.subjects.some((ts) => ts.subjectId === selectedSubject.id)
    );
  }, [teachers, selectedSubject]);

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchStudents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/students?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setStudents(json);
    } catch {
      toast.error(t.common.fetchError);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, t.common.fetchError]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setServices(json);
    } catch {
      toast.error(t.common.fetchError);
    }
  }, [t.common.fetchError]);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTeachers(json);
    } catch {
      toast.error(t.common.fetchError);
    }
  }, [t.common.fetchError]);

  useEffect(() => {
    setLoading(true);
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

  // ── Wizard navigation ──────────────────────────────────────────────────

  const resetWizard = useCallback(() => {
    setWizardStep(1);
    setSelectedService(null);
    setSelectedSubject(null);
    setSelectedLevel(null);
    setSelectedTeacher(null);
    setNoTeacher(false);
    setForm({ ...initialForm });
    setEditingStudent(null);
  }, []);

  const handleOpenDialog = (student?: Student) => {
    if (student) {
      // Edit mode: pre-fill everything and open to step 5
      setEditingStudent(student);
      setForm({
        fullName: student.fullName,
        phone: student.phone || '',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        monthlyFee: student.monthlyFee ? String(student.monthlyFee) : '',
        packMonths: student.packMonths || 1,
      });
      // Pre-select service, subject, level, teacher from student data
      if (student.level?.subject) {
        const svc = services.find(
          (s) => s.id === student.level?.subject?.service?.id
        );
        setSelectedService(svc || null);
        // Find the full subject from services data to get ALL levels
        const fullSubject = svc?.subjects.find(
          (sub) => sub.id === student.level?.subject?.id
        );
        setSelectedSubject({
          id: student.level.subject.id,
          name: student.level.subject.name,
          nameAr: student.level.subject.nameAr,
          nameFr: student.level.subject.nameFr,
          levels: fullSubject?.levels || [],
          order: 0,
        });
        setSelectedLevel({
          id: student.level.id,
          name: student.level.name,
          nameAr: student.level.nameAr,
          nameFr: '',
        });
      } else {
        setSelectedService(null);
        setSelectedSubject(null);
        setSelectedLevel(null);
      }
      if (student.teacherId && student.teacher) {
        setSelectedTeacher({
          id: student.teacher.id,
          fullName: student.teacher.fullName,
          phone: null,
          email: null,
          status: 'active',
          subjects: [],
        });
        setNoTeacher(false);
      } else {
        setSelectedTeacher(null);
        setNoTeacher(!student.teacherId);
      }
      setWizardStep(5);
    } else {
      // Add mode: start from step 1
      resetWizard();
    }
    setDialogOpen(true);
  };

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setSelectedSubject(null);
    setSelectedLevel(null);
    setSelectedTeacher(null);
    setNoTeacher(false);
    setWizardStep(2);
  };

  const handleSelectSubject = (subject: Subject) => {
    setSelectedSubject(subject);
    setSelectedLevel(null);
    setSelectedTeacher(null);
    setNoTeacher(false);
    setWizardStep(3);
  };

  const handleSelectLevel = (level: Level) => {
    setSelectedLevel(level);
    setSelectedTeacher(null);
    setNoTeacher(false);
    setWizardStep(4);
  };

  const handleSelectTeacher = (teacher: Teacher | null) => {
    if (teacher === null) {
      // "بدون أستاذ" option
      setSelectedTeacher(null);
      setNoTeacher(true);
      setWizardStep(5);
    } else {
      setSelectedTeacher(teacher);
      setNoTeacher(false);
      setWizardStep(5);
    }
  };

  const handleSkipTeacher = () => {
    setSelectedTeacher(null);
    setNoTeacher(true);
    setWizardStep(5);
  };

  const goToStep = (step: WizardStep) => {
    if (step < wizardStep) {
      setWizardStep(step);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      toast.error(t.students.nameRequired);
      return;
    }
    if (!selectedLevel) {
      toast.error(t.students.selectLevel);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone || null,
        parentName: form.parentName || null,
        parentPhone: form.parentPhone || null,
        monthlyFee: parseFloat(form.monthlyFee) || 0,
        packMonths: form.packMonths || 1,
        levelId: selectedLevel.id,
        teacherId: noTeacher ? null : (selectedTeacher?.id || null),
        status: editingStudent?.status || 'active',
        enrollmentDate: editingStudent?.enrollmentDate || new Date().toISOString(),
      };

      const url = editingStudent ? `/api/students/${editingStudent.id}` : '/api/students';
      const method = editingStudent ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();

      toast.success(editingStudent ? t.common.updateSuccess : t.common.addSuccess);
      setDialogOpen(false);
      resetWizard();
      fetchStudents();
    } catch {
      toast.error(t.common.saveError);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(t.common.deleteSuccess);
      fetchStudents();
    } catch {
      toast.error(t.common.deleteError);
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
          monthlyFee: student.monthlyFee,
          status: newStatus,
          enrollmentDate: student.enrollmentDate,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === 'active' ? t.students.toggleActive : t.students.toggleInactive);
      fetchStudents();
    } catch {
      toast.error(t.students.toggleError);
    }
  };

  // ── Step indicator config ─────────────────────────────────────────────

  const steps = [
    { num: 1 as WizardStep, icon: Layers, label: t.students.step1Title },
    { num: 2 as WizardStep, icon: BookOpen, label: t.students.step2Title },
    { num: 3 as WizardStep, icon: GraduationCap, label: t.students.step3Title },
    { num: 4 as WizardStep, icon: UserCheck, label: t.students.step4Title },
    { num: 5 as WizardStep, icon: Users, label: t.students.step5Title },
  ];

  // ── Render helpers ────────────────────────────────────────────────────

  function getStatusBadge(status: string) {
    if (status === 'active') {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
          {t.common.active}
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
        {t.common.inactive}
      </Badge>
    );
  }

  function StepIndicator() {
    return (
      <div className="px-8 pt-4 pb-2">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => {
            const isCompleted = step.num < wizardStep;
            const isCurrent = step.num === wizardStep;
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => isCompleted && goToStep(step.num)}
                  disabled={!isCompleted}
                  className={`flex flex-col items-center gap-1 transition-all ${
                    isCompleted
                      ? 'cursor-pointer hover:opacity-80'
                      : 'cursor-default'
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                        : isCompleted
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-[10px] hidden sm:block ${
                      isCurrent
                        ? 'text-teal-700 font-semibold'
                        : isCompleted
                          ? 'text-teal-600'
                          : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 transition-colors ${
                      step.num < wizardStep ? 'bg-teal-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function StepContent() {
    switch (wizardStep) {
      case 1:
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">
              {t.students.servicesAvailable}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {services.map((svc) => {
                const Icon = serviceIcons[svc.name] || Layers;
                const isSelected = selectedService?.id === svc.id;
                const subjectCount = svc.subjects?.length || 0;
                return (
                  <Card
                    key={svc.id}
                    className={`cursor-pointer transition-all hover:shadow-md hover:border-teal-300 ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50 shadow-md ring-1 ring-teal-200'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelectService(svc)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div
                        className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{svc.nameAr}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {subjectCount} {t.students.subjectCount}
                        </p>
                      </div>
                      <ChevronLeft
                        className={`h-5 w-5 shrink-0 transition-colors ${
                          isSelected ? 'text-teal-600' : 'text-muted-foreground'
                        }`}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {services.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t.common.noData}</p>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => goToStep(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h4 className="text-sm font-semibold text-muted-foreground">
                {t.students.subjectsAvailable}
              </h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredSubjects.map((subj) => {
                const isSelected = selectedSubject?.id === subj.id;
                return (
                  <Card
                    key={subj.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 shadow-md ring-1 ring-amber-200'
                        : 'border-border hover:border-amber-300 hover:bg-amber-50/50'
                    }`}
                    onClick={() => handleSelectSubject(subj)}
                  >
                    <CardContent className="p-3 text-center">
                      <div
                        className={`h-10 w-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <p
                        className={`text-xs font-medium leading-tight ${
                          isSelected ? 'text-amber-800' : ''
                        }`}
                      >
                        {subj.nameAr}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {subj.levels?.length || 0} {t.services.levelsLabel}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {filteredSubjects.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t.services.noSubjects}</p>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => goToStep(2)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h4 className="text-sm font-semibold text-muted-foreground">
                {t.students.levelsAvailable}
              </h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredLevels.map((lvl) => {
                const isSelected = selectedLevel?.id === lvl.id;
                return (
                  <Card
                    key={lvl.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50 shadow-md ring-1 ring-teal-200'
                        : 'border-border hover:border-teal-300 hover:bg-teal-50/50'
                    }`}
                    onClick={() => handleSelectLevel(lvl)}
                  >
                    <CardContent className="p-3 text-center">
                      <div
                        className={`h-10 w-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <p
                        className={`text-xs font-medium leading-tight ${
                          isSelected ? 'text-teal-800' : ''
                        }`}
                      >
                        {lvl.nameAr}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {filteredLevels.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t.services.noLevels}</p>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => goToStep(3)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h4 className="text-sm font-semibold text-muted-foreground">
                {t.students.teachersAvailable}
              </h4>
            </div>

            {/* Without teacher option */}
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                noTeacher
                  ? 'border-violet-500 bg-violet-50 shadow-md ring-1 ring-violet-200'
                  : 'border-border hover:border-violet-300'
              }`}
              onClick={() => handleSelectTeacher(null)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    noTeacher
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <UserMinus className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      noTeacher ? 'text-violet-800' : ''
                    }`}
                  >
                    {t.students.withoutTeacher}
                  </p>
                </div>
                {noTeacher && (
                  <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Teacher list */}
            <div className="space-y-2">
              {filteredTeachers.map((teacher) => {
                const isSelected = selectedTeacher?.id === teacher.id && !noTeacher;
                const count = studentCountsMap[teacher.id] || 0;
                return (
                  <Card
                    key={teacher.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50 shadow-md ring-1 ring-teal-200'
                        : 'border-border hover:border-teal-300'
                    }`}
                    onClick={() => handleSelectTeacher(teacher)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          isSelected
                            ? 'bg-teal-100 text-teal-700'
                            : getAvatarColor(teacher.fullName)
                        }`}
                      >
                        {teacher.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected ? 'text-teal-800' : ''
                          }`}
                        >
                          {teacher.fullName}
                        </p>
                        {teacher.phone && (
                          <p className="text-xs text-muted-foreground truncate" dir="ltr">
                            {teacher.phone}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-xs ${
                          count > 0
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {count} {t.students.studentCountLabel}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredTeachers.length === 0 && !noTeacher && (
              <div className="text-center py-8 text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t.common.noData}</p>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/50 border">
              {selectedService && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Layers className="h-3 w-3" />
                  {selectedService.nameAr}
                </Badge>
              )}
              {selectedSubject && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <BookOpen className="h-3 w-3" />
                  {selectedSubject.nameAr}
                </Badge>
              )}
              {selectedLevel && (
                <Badge variant="outline" className="gap-1 text-xs border-teal-300 text-teal-700">
                  <GraduationCap className="h-3 w-3" />
                  {selectedLevel.nameAr}
                </Badge>
              )}
              {!noTeacher && selectedTeacher ? (
                <Badge variant="outline" className="gap-1 text-xs border-teal-300 text-teal-700">
                  <UserCheck className="h-3 w-3" />
                  {selectedTeacher.fullName}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs border-violet-300 text-violet-700">
                  <UserMinus className="h-3 w-3" />
                  {t.students.withoutTeacher}
                </Badge>
              )}
            </div>

            {/* Back to change selections */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => goToStep(selectedTeacher ? 4 : 3)}
              >
                <Pencil className="h-3 w-3" />
                {t.common.edit}
              </Button>
            </div>

            {/* Personal Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-teal-600" />
                {t.students.personalInfo}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="fullName">
                    {t.students.fullName} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder={t.students.fullNamePlaceholder}
                    ref={fullNameInputRef}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="phone">{t.common.phone}</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder={t.students.phonePlaceholder}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Parent Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-600" />
                {t.students.parentInfo}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="parentName">{t.students.parentName}</Label>
                  <Input
                    id="parentName"
                    value={form.parentName}
                    onChange={(e) => setForm((prev) => ({ ...prev, parentName: e.target.value }))}
                    placeholder={t.students.parentNamePlaceholder}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="parentPhone">{t.students.parentPhone}</Label>
                  <Input
                    id="parentPhone"
                    value={form.parentPhone}
                    onChange={(e) => setForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
                    placeholder={t.students.parentPhonePlaceholder}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Monthly Fee */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-amber-600" />
                {t.students.monthlyFeeSection}
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="monthlyFee">{t.students.monthlyFeeLabel}</Label>
                <Input
                  id="monthlyFee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthlyFee}
                  onChange={(e) => setForm((prev) => ({ ...prev, monthlyFee: e.target.value }))}
                  placeholder="0"
                  dir="ltr"
                  className="text-left"
                />
              </div>
              {/* Pack Type (Langues only) */}
              {selectedService?.id === 'service_langues' && (
                <div className="space-y-1.5">
                  <Label>{t.payments.packType}</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: 1, label: t.payments.pack1 },
                      { value: 3, label: t.payments.pack3 },
                      { value: 6, label: t.payments.pack6 },
                      { value: 9, label: t.payments.pack9 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, packMonths: opt.value }))
                        }
                        className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                          form.packMonths === opt.value
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-muted bg-card hover:border-teal-200 hover:bg-teal-50/50 text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-5 w-5" />
          <span className="text-sm">
            {students.length} {t.students.studentCount}
          </span>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          {t.students.addStudent}
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
                  placeholder={t.students.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9"
                />
              </div>
              <TabsList>
                <TabsTrigger value="all">{t.common.all}</TabsTrigger>
                <TabsTrigger value="active">{t.common.active}</TabsTrigger>
                <TabsTrigger value="inactive">{t.common.inactive}</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t.students.noStudents}</p>
              <p className="text-sm mt-1">{t.students.addFirst}</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{t.students.fullName}</TableHead>
                    <TableHead className="text-right hidden md:table-cell">{t.students.level}</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">{t.students.teacher}</TableHead>
                    <TableHead className="text-right hidden md:table-cell">{t.common.phone}</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">{t.students.fee}</TableHead>
                    <TableHead className="text-right">{t.common.status}</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">{t.students.enrollment}</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium text-right">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(student.fullName)}`}>
                            {student.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{student.fullName}</p>
                            {student.parentName && (
                              <p className="text-xs text-muted-foreground truncate">
                                {t.students.guardian}{student.parentName}
                              </p>
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
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(student.teacher.fullName)}`}>
                              {student.teacher.fullName.charAt(0)}
                            </div>
                            <span>{student.teacher.fullName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">{t.students.withoutTeacher}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {student.phone || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {student.monthlyFee > 0 ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium">
                            {student.monthlyFee.toLocaleString('ar-MA')} {t.common.dh}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
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
                                <AlertDialogTitle>{t.common.deleteConfirm}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t.students.deleteConfirmMsg} &quot;{student.fullName}&quot;? {t.common.cannotUndo}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(student.id)}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  {t.common.delete}
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
          REGISTRATION WIZARD DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            resetWizard();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="px-8 pt-6 pb-2 shrink-0">
            <DialogTitle>
              {editingStudent ? t.students.editStudent : t.students.addStudent}
            </DialogTitle>
            <DialogDescription>
              {editingStudent ? t.students.editDesc : t.students.addDesc}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          {editingStudent ? null : StepIndicator()}

          {/* Body - scrollable */}
          <div className="flex-1 overflow-y-auto px-8 pb-4 min-h-0">
            {StepContent()}
          </div>

          {/* Footer - sticky */}
          <DialogFooter className="px-8 py-4 border-t shrink-0">
            <div className="flex items-center justify-between w-full gap-2">
              {/* Left side: back or skip */}
              <div>
                {wizardStep === 4 && !editingStudent && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSkipTeacher}
                    className="gap-1 text-muted-foreground"
                  >
                    {t.common.skip}
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                )}
                {wizardStep > 1 && wizardStep < 5 && !editingStudent && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => goToStep((wizardStep - 1) as WizardStep)}
                    className="gap-1"
                  >
                    {t.common.back}
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Right side: cancel + save */}
              <div className="flex items-center gap-2">
                {editingStudent && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="outline" className="text-destructive hover:text-destructive gap-1">
                        <Trash2 className="h-4 w-4" />
                        {t.common.delete}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t.common.deleteConfirm}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t.students.deleteConfirmMsg} &quot;{editingStudent.fullName}&quot;? {t.common.cannotUndo}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            handleDelete(editingStudent.id);
                            setDialogOpen(false);
                            resetWizard();
                          }}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          {t.common.delete}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetWizard();
                  }}
                >
                  {t.common.cancel}
                </Button>
                {wizardStep === 5 && (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !form.fullName.trim() || !selectedLevel}
                    className="gap-1"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingStudent ? t.common.saveChanges : t.students.addStudent}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
