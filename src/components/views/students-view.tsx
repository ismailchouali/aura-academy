'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useT } from '@/hooks/use-translation';
import { useAppStore } from '@/store/store';
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
  CircleCheck,
  CircleAlert,
  X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Enrollment {
  id?: string;
  studentId?: string;
  serviceId: string;
  service: { id: string; name: string; nameAr: string; nameFr: string } | null;
  subjectId: string | null;
  subject: { id: string; name: string; nameAr: string; nameFr: string } | null;
  levelId: string | null;
  level: {
    id: string;
    name: string;
    nameAr: string;
    nameFr: string;
    subject?: { nameAr: string; name?: string; service?: { id: string; nameAr: string } };
  } | null;
  teacherId: string | null;
  teacher: { id: string; fullName: string } | null;
  monthlyFee: number;
  packMonths: number;
  status: string;
  enrollmentDate: string;
  isPackPaid?: boolean;
  nextDueDate?: string | null;
  payments?: any[];
}

interface Student {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  parentName: string | null;
  parentPhone: string | null;
  status: string;
  enrollmentDate: string;
  enrollments: Enrollment[];
  // Legacy fields (kept for backward compatibility if API returns them)
  levelId?: string | null;
  level?: any;
  teacherId?: string | null;
  teacher?: any;
  monthlyFee?: number;
  packMonths?: number;
  isPackPaid?: boolean;
  nextDueDate?: string | null;
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

interface EnrollmentDraft {
  serviceId: string;
  serviceNameAr: string;
  subjectId: string;
  subjectNameAr: string;
  levelId: string;
  levelNameAr: string;
  teacherId: string | null;
  teacherName: string;
  noTeacher: boolean;
  monthlyFee: string;
  packMonths: number;
}

interface FormState {
  fullName: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  enrollmentDate: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const initialForm: FormState = {
  fullName: '',
  phone: '',
  parentName: '',
  parentPhone: '',
  enrollmentDate: new Date().toISOString().split('T')[0],
};

const emptyDraft = (): EnrollmentDraft => ({
  serviceId: '',
  serviceNameAr: '',
  subjectId: '',
  subjectNameAr: '',
  levelId: '',
  levelNameAr: '',
  teacherId: null,
  teacherName: '',
  noTeacher: false,
  monthlyFee: '',
  packMonths: 1,
});

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
  const { userRole } = useAppStore();
  const isAdmin = userRole === 'ADMIN';

  // ── Data state ──────────────────────────────────────────────────────────
  const [students, setStudents] = useState<Student[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Table filter state (service → subject → level) ────────────────
  const [filterServiceId, setFilterServiceId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterLevelId, setFilterLevelId] = useState('');

  // ── Wizard state ────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Current draft being built in steps 1-4
  const [currentDraft, setCurrentDraft] = useState<EnrollmentDraft>(emptyDraft());

  // Accumulated enrollments when adding a new student (step 5 collects these)
  const [enrollmentsBeingAdded, setEnrollmentsBeingAdded] = useState<EnrollmentDraft[]>([]);

  // Existing enrollments when editing
  const [editEnrollments, setEditEnrollments] = useState<Enrollment[]>([]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // ── Ref for fullName input (auto-focus only once on step 5) ─────────────
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const prevStepRef = useRef<WizardStep>(1);

  useEffect(() => {
    if (wizardStep === 5 && prevStepRef.current !== 5) {
      setTimeout(() => fullNameInputRef.current?.focus(), 100);
    }
    prevStepRef.current = wizardStep;
  }, [wizardStep]);

  // ── Delete state ────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Computed: student count per teacher (from enrollments) ─────────────
  const studentCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    const counted = new Set<string>();
    for (const s of students) {
      const enrollments = s.enrollments || [];
      if (enrollments.length > 0) {
        for (const e of enrollments) {
          if (e.teacherId && !counted.has(`${s.id}-${e.teacherId}`)) {
            map[e.teacherId] = (map[e.teacherId] || 0) + 1;
            counted.add(`${s.id}-${e.teacherId}`);
          }
        }
      } else if (s.teacherId) {
        // Legacy fallback
        map[s.teacherId] = (map[s.teacherId] || 0) + 1;
      }
    }
    return map;
  }, [students]);

  // ── Computed: filter subjects dropdown based on selected service ───
  const filterSubjects = useMemo(() => {
    if (!filterServiceId) return [];
    const svc = services.find((s) => s.id === filterServiceId);
    return svc?.subjects || [];
  }, [filterServiceId, services]);

  // ── Computed: filter levels dropdown based on selected subject ──────
  const filterLevels = useMemo(() => {
    if (!filterSubjectId) return [];
    const svc = services.find((s) => s.id === filterServiceId);
    const subj = svc?.subjects.find((sub) => sub.id === filterSubjectId);
    return subj?.levels || [];
  }, [filterServiceId, filterSubjectId, services]);

  // ── Computed: displayed students after all filters (based on enrollments) ─
  const displayedStudents = useMemo(() => {
    return students.filter((s) => {
      const enrollments = s.enrollments || [];
      if (enrollments.length > 0) {
        const matches = enrollments.some((e) => {
          if (filterServiceId && e.serviceId !== filterServiceId) return false;
          if (filterSubjectId && e.subjectId !== filterSubjectId) return false;
          if (filterLevelId && e.levelId !== filterLevelId) return false;
          return true;
        });
        if (!matches) return false;
      } else {
        // Legacy fallback
        if (filterServiceId && s.level?.subject?.service?.id !== filterServiceId) return false;
        if (filterSubjectId && s.level?.subject?.id !== filterSubjectId) return false;
        if (filterLevelId && s.levelId !== filterLevelId) return false;
      }
      return true;
    });
  }, [students, filterServiceId, filterSubjectId, filterLevelId]);

  // Reset child filters when parent changes
  const handleFilterServiceChange = (v: string) => {
    setFilterServiceId(v);
    setFilterSubjectId('');
    setFilterLevelId('');
  };
  const handleFilterSubjectChange = (v: string) => {
    setFilterSubjectId(v);
    setFilterLevelId('');
  };

  // ── Computed: filtered subjects for step 2 (based on currentDraft.serviceId) ─
  const filteredSubjects = useMemo(() => {
    const svc = services.find((s) => s.id === currentDraft.serviceId);
    return svc?.subjects || [];
  }, [currentDraft.serviceId, services]);

  // ── Computed: filtered levels for step 3 (deduplicated by name) ───────
  const filteredLevels = useMemo(() => {
    const svc = services.find((s) => s.id === currentDraft.serviceId);
    const subj = svc?.subjects.find((sub) => sub.id === currentDraft.subjectId);
    if (!subj) return [];
    const levels = subj.levels || [];
    const seen = new Map<string, Level>();
    for (const lvl of levels) {
      if (!seen.has(lvl.name)) {
        seen.set(lvl.name, lvl);
      }
    }
    return Array.from(seen.values());
  }, [currentDraft.serviceId, currentDraft.subjectId, services]);

  // ── Computed: filtered teachers for step 4 ─────────────────────────────
  const filteredTeachers = useMemo(() => {
    if (!currentDraft.subjectId) return [];
    return teachers.filter(
      (teacher) =>
        teacher.status === 'active' &&
        teacher.subjects.some((ts) => ts.subjectId === currentDraft.subjectId)
    );
  }, [teachers, currentDraft.subjectId]);

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
    setCurrentDraft(emptyDraft());
    setEnrollmentsBeingAdded([]);
    setEditEnrollments([]);
    setForm({ ...initialForm });
    setEditingStudent(null);
  }, []);

  const handleOpenDialog = (student?: Student) => {
    if (student) {
      // Edit mode: show personal info + existing enrollments
      setEditingStudent(student);
      setForm({
        fullName: student.fullName,
        phone: student.phone || '',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        enrollmentDate: student.enrollmentDate
          ? new Date(student.enrollmentDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      });
      setEditEnrollments(student.enrollments || []);
      setCurrentDraft(emptyDraft());
      setEnrollmentsBeingAdded([]);
      setWizardStep(5);
    } else {
      // Add mode: start from step 1
      resetWizard();
    }
    setDialogOpen(true);
  };

  // ── Step 1-4 handlers (modify currentDraft) ──────────────────────────

  const handleSelectService = (service: Service) => {
    setCurrentDraft((d) => ({
      ...d,
      serviceId: service.id,
      serviceNameAr: service.nameAr,
      subjectId: '',
      subjectNameAr: '',
      levelId: '',
      levelNameAr: '',
      teacherId: null,
      teacherName: '',
      noTeacher: false,
      monthlyFee: '',
      packMonths: 1,
    }));
    setWizardStep(2);
  };

  const handleSelectSubject = (subject: Subject) => {
    setCurrentDraft((d) => ({
      ...d,
      subjectId: subject.id,
      subjectNameAr: subject.nameAr,
      levelId: '',
      levelNameAr: '',
      teacherId: null,
      teacherName: '',
      noTeacher: false,
    }));
    setWizardStep(3);
  };

  const handleSelectLevel = (level: Level) => {
    setCurrentDraft((d) => ({
      ...d,
      levelId: level.id,
      levelNameAr: level.nameAr,
      teacherId: null,
      teacherName: '',
      noTeacher: false,
    }));
    setWizardStep(4);
  };

  const buildEnrollmentFromDraft = (draft: EnrollmentDraft, teacherId: string | null, teacherName: string, noTeacher: boolean): Enrollment => ({
    serviceId: draft.serviceId,
    service: services.find((s) => s.id === draft.serviceId) ? { id: draft.serviceId, name: '', nameAr: draft.serviceNameAr, nameFr: '' } : null,
    subjectId: draft.subjectId || null,
    subject: draft.subjectId ? { id: draft.subjectId, name: '', nameAr: draft.subjectNameAr, nameFr: '' } : null,
    levelId: draft.levelId,
    level: { id: draft.levelId, name: '', nameAr: draft.levelNameAr, nameFr: '' },
    teacherId: noTeacher ? null : (teacherId || null),
    teacher: noTeacher ? null : (teacherId ? { id: teacherId, fullName: teacherName } : null),
    monthlyFee: parseFloat(draft.monthlyFee) || 0,
    packMonths: draft.packMonths || 1,
    status: 'active',
    enrollmentDate: form.enrollmentDate || new Date().toISOString(),
    isPackPaid: false,
  });

  const handleSelectTeacher = (teacher: Teacher | null) => {
    const teacherId = teacher ? teacher.id : null;
    const teacherName = teacher ? teacher.fullName : '';
    const noTeacherFlag = !teacher;

    if (editingStudent) {
      // Edit mode: add to editEnrollments
      const newEnrollment = buildEnrollmentFromDraft(currentDraft, teacherId, teacherName, noTeacherFlag);
      setEditEnrollments((prev) => [...prev, newEnrollment]);
    } else {
      // Add mode: add to enrollmentsBeingAdded
      setEnrollmentsBeingAdded((prev) => [...prev, { ...currentDraft, teacherId, teacherName, noTeacher: noTeacherFlag }]);
    }
    setCurrentDraft(emptyDraft());
    setWizardStep(5);
  };

  const handleSkipTeacher = () => {
    if (editingStudent) {
      // Edit mode: add to editEnrollments
      const newEnrollment = buildEnrollmentFromDraft(currentDraft, null, '', true);
      setEditEnrollments((prev) => [...prev, newEnrollment]);
    } else {
      // Add mode: add to enrollmentsBeingAdded
      setEnrollmentsBeingAdded((prev) => [...prev, { ...currentDraft, teacherId: null, teacherName: '', noTeacher: true }]);
    }
    setCurrentDraft(emptyDraft());
    setWizardStep(5);
  };

  const goToStep = (step: WizardStep) => {
    if (step < wizardStep) {
      setWizardStep(step);
    }
  };

  // ── Add another service from step 5 (go back to step 1, keep form) ──
  const handleAddAnotherService = () => {
    setCurrentDraft(emptyDraft());
    setWizardStep(1);
  };

  // ── Remove an enrollment from the list on step 5 ─────────────────────
  const removeEnrollmentBeingAdded = (index: number) => {
    setEnrollmentsBeingAdded((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Edit mode: remove existing enrollment ───────────────────────────
  const removeEditEnrollment = (index: number) => {
    setEditEnrollments((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Edit mode: finish adding sub-wizard enrollment (via footer button) ──
  const handleEditAddEnrollment = () => {
    const draft = currentDraft;
    if (!draft.serviceId || !draft.levelId) {
      toast.error(t.students.selectLevel);
      return;
    }
    const newEnrollment = buildEnrollmentFromDraft(draft, draft.noTeacher ? null : draft.teacherId, draft.teacherName, draft.noTeacher);
    setEditEnrollments((prev) => [...prev, newEnrollment]);
    setCurrentDraft(emptyDraft());
    setWizardStep(5);
  };

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      toast.error(t.students.nameRequired);
      return;
    }

    if (editingStudent) {
      // Edit mode: send personal info + all enrollments
      const allEnrollments = editEnrollments.map((e) => ({
        id: e.id,
        serviceId: e.serviceId,
        subjectId: e.subjectId,
        levelId: e.levelId,
        teacherId: e.teacherId,
        monthlyFee: e.monthlyFee,
        packMonths: e.packMonths,
        enrollmentDate: e.enrollmentDate || form.enrollmentDate,
      }));

      if (allEnrollments.length === 0) {
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
          status: editingStudent.status,
          enrollmentDate: form.enrollmentDate || new Date().toISOString(),
          enrollments: allEnrollments,
        };

        const res = await fetch(`/api/students/${editingStudent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();

        toast.success(t.common.updateSuccess);
        setDialogOpen(false);
        resetWizard();
        fetchStudents();
      } catch {
        toast.error(t.common.saveError);
      } finally {
        setSubmitting(false);
      }
    } else {
      // Add mode
      if (enrollmentsBeingAdded.length === 0) {
        toast.error(t.students.selectLevel);
        return;
      }

      setSubmitting(true);
      try {
        const enrollmentPayloads = enrollmentsBeingAdded.map((d) => ({
          serviceId: d.serviceId,
          subjectId: d.subjectId || null,
          levelId: d.levelId,
          teacherId: d.noTeacher ? null : (d.teacherId || null),
          monthlyFee: isAdmin ? (parseFloat(d.monthlyFee) || 0) : 0,
          packMonths: d.packMonths || 1,
          enrollmentDate: form.enrollmentDate || new Date().toISOString(),
        }));

        const payload = {
          fullName: form.fullName.trim(),
          phone: form.phone || null,
          parentName: form.parentName || null,
          parentPhone: form.parentPhone || null,
          status: 'active',
          enrollmentDate: form.enrollmentDate || new Date().toISOString(),
          enrollments: enrollmentPayloads,
        };

        const res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();

        toast.success(t.common.addSuccess);
        setDialogOpen(false);
        resetWizard();
        fetchStudents();
      } catch {
        toast.error(t.common.saveError);
      } finally {
        setSubmitting(false);
      }
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
      // Build enrollments array from student data
      const enrollmentsPayload = (student.enrollments || []).map((e) => ({
        id: e.id,
        serviceId: e.serviceId,
        subjectId: e.subjectId,
        levelId: e.levelId,
        teacherId: e.teacherId,
        monthlyFee: e.monthlyFee,
        packMonths: e.packMonths,
        enrollmentDate: e.enrollmentDate,
      }));

      const payload: any = {
        fullName: student.fullName,
        phone: student.phone,
        email: student.email,
        address: student.address,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        status: newStatus,
        enrollmentDate: student.enrollmentDate,
      };
      if (enrollmentsPayload.length > 0) {
        payload.enrollments = enrollmentsPayload;
      } else {
        payload.levelId = student.levelId;
        payload.teacherId = student.teacherId;
        payload.monthlyFee = student.monthlyFee;
      }

      const res = await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === 'active' ? t.students.toggleActive : t.students.toggleInactive);
      fetchStudents();
    } catch {
      toast.error(t.students.toggleError);
    }
  };

  // ── Helper: get student's aggregate data from enrollments ────────────
  function getStudentEnrollmentData(student: Student) {
    const enrollments = student.enrollments || [];
    const hasEnrollments = enrollments.length > 0;
    return {
      hasEnrollments,
      totalFee: hasEnrollments
        ? enrollments.reduce((sum, e) => sum + (e.monthlyFee || 0), 0)
        : (student.monthlyFee || 0),
      allPackPaid: hasEnrollments
        ? enrollments.every((e) => e.isPackPaid)
        : !!student.isPackPaid,
      earliestDueDate: hasEnrollments
        ? enrollments
            .filter((e) => e.nextDueDate)
            .sort((a, b) => new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime())[0]?.nextDueDate || null
        : (student.nextDueDate || null),
    };
  }

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

  // ── Render: enrollment badge for a draft ─────────────────────────────
  function renderDraftBadge(draft: EnrollmentDraft, index: number, removable: boolean) {
    return (
      <div
        key={index}
        className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
      >
        <div className="flex-1 min-w-0 flex flex-wrap gap-1">
          <Badge variant="outline" className="gap-1 text-xs">
            <Layers className="h-3 w-3" />
            {draft.serviceNameAr}
          </Badge>
          {draft.subjectNameAr && (
            <Badge variant="outline" className="gap-1 text-xs">
              <BookOpen className="h-3 w-3" />
              {draft.subjectNameAr}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 text-xs border-teal-300 text-teal-700">
            <GraduationCap className="h-3 w-3" />
            {draft.levelNameAr}
          </Badge>
          {draft.noTeacher ? (
            <Badge variant="outline" className="gap-1 text-xs border-violet-300 text-violet-700">
              <UserMinus className="h-3 w-3" />
              {t.students.withoutTeacher}
            </Badge>
          ) : draft.teacherName ? (
            <Badge variant="outline" className="gap-1 text-xs border-teal-300 text-teal-700">
              <UserCheck className="h-3 w-3" />
              {draft.teacherName}
            </Badge>
          ) : null}
          {isAdmin && draft.monthlyFee && parseFloat(draft.monthlyFee) > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">
              <Wallet className="h-3 w-3" />
              {parseFloat(draft.monthlyFee).toLocaleString('ar-MA')} {t.common.dh}
            </Badge>
          )}
        </div>
        {removable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeEnrollmentBeingAdded(index)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  // ── Render: enrollment card for edit mode ─────────────────────────────
  function renderEditEnrollmentCard(enrollment: Enrollment, index: number) {
    return (
      <div
        key={enrollment.id || index}
        className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30"
      >
        <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
          {enrollment.service && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Layers className="h-3 w-3" />
              {enrollment.service.nameAr}
            </Badge>
          )}
          {enrollment.subject && (
            <Badge variant="outline" className="gap-1 text-xs">
              <BookOpen className="h-3 w-3" />
              {enrollment.subject.nameAr}
            </Badge>
          )}
          {enrollment.level && (
            <Badge variant="outline" className="gap-1 text-xs border-teal-300 text-teal-700">
              <GraduationCap className="h-3 w-3" />
              {enrollment.level.nameAr}
            </Badge>
          )}
          {enrollment.teacher ? (
            <Badge variant="outline" className="gap-1 text-xs border-teal-300 text-teal-700">
              <UserCheck className="h-3 w-3" />
              {enrollment.teacher.fullName}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-xs border-violet-300 text-violet-700">
              <UserMinus className="h-3 w-3" />
              {t.students.withoutTeacher}
            </Badge>
          )}
          {isAdmin && enrollment.monthlyFee > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">
              <Wallet className="h-3 w-3" />
              {enrollment.monthlyFee.toLocaleString('ar-MA')} {t.common.dh}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => removeEditEnrollment(index)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
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
                const isSelected = currentDraft.serviceId === svc.id;
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
                const isSelected = currentDraft.subjectId === subj.id;
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
                const isSelected = currentDraft.levelId === lvl.id;
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
                currentDraft.noTeacher
                  ? 'border-violet-500 bg-violet-50 shadow-md ring-1 ring-violet-200'
                  : 'border-border hover:border-violet-300'
              }`}
              onClick={() => handleSelectTeacher(null)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    currentDraft.noTeacher
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <UserMinus className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      currentDraft.noTeacher ? 'text-violet-800' : ''
                    }`}
                  >
                    {t.students.withoutTeacher}
                  </p>
                </div>
                {currentDraft.noTeacher && (
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
                const isSelected = currentDraft.teacherId === teacher.id && !currentDraft.noTeacher;
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

            {filteredTeachers.length === 0 && !currentDraft.noTeacher && (
              <div className="text-center py-8 text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t.common.noData}</p>
              </div>
            )}
          </div>
        );

      case 5:
        if (editingStudent) {
          // ═══ EDIT MODE ═══
          return (
            <div className="space-y-4">
              {/* Personal Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-teal-600" />
                  {t.students.personalInfo}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="editFullName">
                      {t.students.fullName} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="editFullName"
                      value={form.fullName}
                      onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                      placeholder={t.students.fullNamePlaceholder}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="editPhone">{t.common.phone}</Label>
                    <Input
                      id="editPhone"
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
                    <Label htmlFor="editParentName">{t.students.parentName}</Label>
                    <Input
                      id="editParentName"
                      value={form.parentName}
                      onChange={(e) => setForm((prev) => ({ ...prev, parentName: e.target.value }))}
                      placeholder={t.students.parentNamePlaceholder}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editParentPhone">{t.students.parentPhone}</Label>
                    <Input
                      id="editParentPhone"
                      value={form.parentPhone}
                      onChange={(e) => setForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
                      placeholder={t.students.parentPhonePlaceholder}
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Enrollment Date */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-teal-600" />
                  {t.students.enrollmentDateLabel}
                </h4>
                <div className="space-y-1.5">
                  <Label htmlFor="editEnrollmentDate">{t.students.enrollmentDateLabel}</Label>
                  <Input
                    id="editEnrollmentDate"
                    type="date"
                    value={form.enrollmentDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, enrollmentDate: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
              </div>

              {/* Existing Enrollments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-teal-600" />
                    {t.students.enrollmentsLabel}
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setCurrentDraft(emptyDraft());
                      setWizardStep(1);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    {t.students.addEnrollment}
                  </Button>
                </div>
                {editEnrollments.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t.students.noEnrollmentsYet}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editEnrollments.map((enr, idx) => renderEditEnrollmentCard(enr, idx))}
                    {/* Fee inputs for each enrollment (admin only) */}
                    {isAdmin && editEnrollments.length > 0 && (
                      <div className="space-y-3 pt-1">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-amber-600" />
                          {t.students.enrollmentFee}
                        </h4>
                        {editEnrollments.map((enr, idx) => {
                          const svc = services.find((s) => s.id === enr.serviceId);
                          const isLangues = svc?.id === 'service_langues';
                          const label = [enr.service?.nameAr, enr.subject?.nameAr, enr.level?.nameAr].filter(Boolean).join(' — ');
                          return (
                            <div key={enr.id || idx} className="p-2 rounded-lg border bg-muted/20 space-y-2">
                              <p className="text-xs text-muted-foreground truncate">
                                {label}
                              </p>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={enr.monthlyFee || ''}
                                  onChange={(e) => {
                                    setEditEnrollments((prev) =>
                                      prev.map((en, i) =>
                                        i === idx ? { ...en, monthlyFee: parseFloat(e.target.value) || 0 } : en
                                      )
                                    );
                                  }}
                                  placeholder="0"
                                  dir="ltr"
                                  className="text-left h-8 text-sm"
                                />
                                <span className="text-xs text-muted-foreground shrink-0">{t.common.dh}</span>
                              </div>
                              {isLangues && (
                                <div className="flex gap-1.5">
                                  {[
                                    { value: 1, label: t.payments.pack1 },
                                    { value: 3, label: t.payments.pack3 },
                                    { value: 6, label: t.payments.pack6 },
                                    { value: 9, label: t.payments.pack9 },
                                  ].map((opt) => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => {
                                        setEditEnrollments((prev) =>
                                          prev.map((en, i) =>
                                            i === idx ? { ...en, packMonths: opt.value } : en
                                          )
                                        );
                                      }}
                                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                        enr.packMonths === opt.value
                                          ? 'bg-teal-100 text-teal-700 border-teal-300'
                                          : 'bg-white text-muted-foreground border-border hover:border-teal-300'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Show total fee */}
                    {isAdmin && editEnrollments.length > 1 && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <span className="text-sm text-muted-foreground">{t.students.totalFee}:</span>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium">
                          {editEnrollments.reduce((sum, e) => sum + (e.monthlyFee || 0), 0).toLocaleString('ar-MA')} {t.common.dh}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }

        // ═══ ADD MODE (step 5) ═══
        return (
          <div className="space-y-4">
            {/* Already-added enrollments as badges */}
            {enrollmentsBeingAdded.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-teal-600" />
                  {t.students.enrollmentsLabel} ({enrollmentsBeingAdded.length})
                </h4>
                <div className="space-y-2">
                  {enrollmentsBeingAdded.map((draft, idx) =>
                    renderDraftBadge(draft, idx, true)
                  )}
                  {/* Total fee */}
                  {isAdmin && enrollmentsBeingAdded.length > 1 && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <span className="text-sm text-muted-foreground">{t.students.totalFee}:</span>
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium">
                        {enrollmentsBeingAdded
                          .reduce((sum, d) => sum + (parseFloat(d.monthlyFee) || 0), 0)
                          .toLocaleString('ar-MA')} {t.common.dh}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Monthly Fee for the LAST added enrollment (admin only) */}
            {isAdmin && enrollmentsBeingAdded.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-600" />
                  {t.students.enrollmentFee}
                </h4>
                <div className="space-y-1.5">
                  {enrollmentsBeingAdded.map((draft, idx) => {
                    const svc = services.find((s) => s.id === draft.serviceId);
                    const isLangues = svc?.id === 'service_langues';
                    return (
                      <div key={idx} className="p-2 rounded-lg border bg-muted/20 space-y-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {draft.serviceNameAr} {draft.subjectNameAr ? `— ${draft.subjectNameAr}` : ''} {draft.levelNameAr ? `— ${draft.levelNameAr}` : ''}
                        </p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.monthlyFee}
                            onChange={(e) => {
                              setEnrollmentsBeingAdded((prev) =>
                                prev.map((d, i) =>
                                  i === idx ? { ...d, monthlyFee: e.target.value } : d
                                )
                              );
                            }}
                            placeholder="0"
                            dir="ltr"
                            className="text-left h-8 text-sm"
                          />
                          <span className="text-xs text-muted-foreground shrink-0">{t.common.dh}</span>
                        </div>
                        {isLangues && (
                          <div className="flex gap-1.5">
                            {[
                              { value: 1, label: t.payments.pack1 },
                              { value: 3, label: t.payments.pack3 },
                              { value: 6, label: t.payments.pack6 },
                              { value: 9, label: t.payments.pack9 },
                            ].map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setEnrollmentsBeingAdded((prev) =>
                                    prev.map((d, i) =>
                                      i === idx ? { ...d, packMonths: opt.value } : d
                                    )
                                  );
                                }}
                                className={`px-2 py-1 rounded-md border-2 text-[11px] font-medium transition-colors ${
                                  draft.packMonths === opt.value
                                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                                    : 'border-muted bg-card hover:border-teal-200 text-foreground'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add another service button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-9 border-dashed gap-2 text-sm"
              onClick={handleAddAnotherService}
            >
              <Plus className="h-4 w-4" />
              {t.students.anotherService}
            </Button>

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

            {/* Enrollment Date */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-teal-600" />
                {t.students.enrollmentDateLabel}
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="enrollmentDate">{t.students.enrollmentDateLabel}</Label>
                <Input
                  id="enrollmentDate"
                  type="date"
                  value={form.enrollmentDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, enrollmentDate: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  dir="ltr"
                  className="text-left"
                />
              </div>
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
            {displayedStudents.length} {t.students.studentCount}
          </span>
          {(filterServiceId || filterSubjectId || filterLevelId) && (
            <button
              onClick={() => { setFilterServiceId(''); setFilterSubjectId(''); setFilterLevelId(''); }}
              className="text-xs text-teal-600 hover:text-teal-800 underline"
            >
              إعادة تعيين الفلاتر
            </button>
          )}
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
            <div className="flex flex-col gap-3">
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
              {/* Service / Subject / Level filters */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={filterServiceId}
                  onChange={(e) => handleFilterServiceChange(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="">كل الخدمات</option>
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>{svc.nameAr}</option>
                  ))}
                </select>
                {filterSubjects.length > 0 && (
                  <select
                    value={filterSubjectId}
                    onChange={(e) => handleFilterSubjectChange(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="">كل المواد</option>
                    {filterSubjects.map((subj) => (
                      <option key={subj.id} value={subj.id}>{subj.nameAr}</option>
                    ))}
                  </select>
                )}
                {filterLevels.length > 0 && (
                  <select
                    value={filterLevelId}
                    onChange={(e) => setFilterLevelId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="">كل المستويات</option>
                    {filterLevels.map((lvl) => (
                      <option key={lvl.id} value={lvl.id}>{lvl.nameAr}</option>
                    ))}
                  </select>
                )}
                {(filterServiceId || filterSubjectId || filterLevelId) && (
                  <Badge className="bg-teal-100 text-teal-700 border-teal-200 h-9 px-3 font-medium">
                    {displayedStudents.length} طالب
                  </Badge>
                )}
              </div>
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
          ) : displayedStudents.length === 0 ? (
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
                    {isAdmin && (
                      <TableHead className="text-right hidden sm:table-cell">{t.students.fee}</TableHead>
                    )}
                    {isAdmin && (
                      <TableHead className="text-center">الدفعة</TableHead>
                    )}
                    <TableHead className="text-right">{t.common.status}</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">{t.students.enrollment}</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedStudents.map((student) => {
                    const enrollments = student.enrollments || [];
                    const hasEnrollments = enrollments.length > 0;
                    const data = getStudentEnrollmentData(student);

                    return (
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
                          {hasEnrollments ? (
                            <div className="flex flex-wrap gap-1">
                              {enrollments.map((e, idx) => (
                                <Badge key={e.id || idx} variant="outline" className="text-[11px] gap-0.5">
                                  {e.level?.subject?.nameAr && (
                                    <span className="text-muted-foreground">{e.level.subject.nameAr}</span>
                                  )}
                                  {e.level?.subject?.nameAr && e.level?.nameAr && (
                                    <span className="mx-0.5">—</span>
                                  )}
                                  {e.level?.nameAr && (
                                    <span className="font-medium">{e.level.nameAr}</span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          ) : student.level ? (
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
                          {hasEnrollments ? (
                            <div className="flex flex-wrap gap-1">
                              {enrollments
                                .filter((e) => e.teacher)
                                .map((e, idx) => (
                                  <span key={e.id || idx} className="text-sm">
                                    {e.teacher!.fullName}
                                    {idx < enrollments.filter((ee) => ee.teacher).length - 1 && (
                                      <span className="text-muted-foreground">، </span>
                                    )}
                                  </span>
                                ))}
                              {!enrollments.some((e) => e.teacher) && (
                                <span className="text-muted-foreground text-sm">{t.students.withoutTeacher}</span>
                              )}
                            </div>
                          ) : student.teacher ? (
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
                        {isAdmin && (
                          <TableCell className="text-right hidden sm:table-cell">
                            {data.totalFee > 0 ? (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium">
                                {data.totalFee.toLocaleString('ar-MA')} {t.common.dh}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        )}
                        {isAdmin && (
                          <TableCell className="text-center">
                            {data.allPackPaid ? (
                              <div className="flex items-center justify-center gap-1" title="الpack مخلص">
                                <CircleCheck className="h-5 w-5 text-emerald-500" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1" title={data.earliestDueDate ? `تاريخ الاستحقاق: ${data.earliestDueDate}` : 'لم يدفع بعد'}>
                                <CircleAlert className="h-5 w-5 text-red-400" />
                              </div>
                            )}
                          </TableCell>
                        )}
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
                    );
                  })}
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

          {/* Step indicator (hide in edit mode or when on step 5 in edit mode) */}
          {!editingStudent && StepIndicator()}

          {/* Body - scrollable */}
          <div className="flex-1 overflow-y-auto px-8 pb-4 min-h-0">
            {StepContent()}
          </div>

          {/* Footer - sticky */}
          <DialogFooter className="px-8 py-4 border-t shrink-0">
            <div className="flex items-center justify-between w-full gap-2">
              {/* Left side: back or skip */}
              <div>
                {wizardStep === 4 && (
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
                {/* In edit mode step 1-4: save enrollment (back to step 5) */}
                {editingStudent && wizardStep < 5 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (wizardStep < 5 && currentDraft.levelId) {
                        handleEditAddEnrollment();
                      } else {
                        // Cancel sub-wizard, go back to step 5
                        setCurrentDraft(emptyDraft());
                        setWizardStep(5);
                      }
                    }}
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
                    disabled={
                      submitting ||
                      !form.fullName.trim() ||
                      (editingStudent
                        ? editEnrollments.length === 0
                        : enrollmentsBeingAdded.length === 0)
                    }
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