'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  DoorOpen,
  Users,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Clock,
  AlertTriangle,
  DoorOpenIcon,
  Wallet,
  Phone,
  User,
  Loader2,
  CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Types ──────────────────────────────────────────────────────────────────

interface ScheduleItem {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: { name: string; nameAr: string };
  teacher: { fullName: string } | null;
  level: { name: string; nameAr: string } | null;
}

interface Classroom {
  id: string;
  name: string;
  nameAr: string;
  capacity: number;
  schedules: ScheduleItem[];
}

interface OverdueStudent {
  studentId: string;
  studentName: string;
  phone: string | null;
  parentPhone: string | null;
  parentName: string | null;
  monthlyFee: number;
  levelName: string;
  subjectName: string;
  totalOverdue: number;
  monthsOverdue: number;
  hasPendingPayment: boolean;
  pendingPaymentId: string | null;
  nextDueDate: string | null;
  overduePayments: {
    id: string;
    month: string;
    monthLabel: string;
    year: number;
    remainingAmount: number;
    monthsOverdue: number;
  }[];
}

interface OverdueData {
  classroomId: string;
  classroomName: string;
  students: OverdueStudent[];
  totalOverdue: number;
  studentCount: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DAY_MAP: Record<string, string> = {
  '1': 'الأحد',
  '2': 'الاثنين',
  '3': 'الثلاثاء',
  '4': 'الأربعاء',
  '5': 'الخميس',
  '6': 'الجمعة',
  '7': 'السبت',
};

const MONTH_KEYS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const CLASSROOM_COLORS = [
  { accent: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { accent: 'bg-violet-500', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  { accent: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
];

function getTodayDayOfWeek(): string {
  const jsDay = new Date().getDay();
  // JS: 0=Sun, 1=Mon, ..., 6=Sat
  // Our system: 1=Sun, 2=Mon, ..., 7=Sat
  return String(jsDay === 0 ? 1 : jsDay + 1);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Separator />
              <Skeleton className="h-4 w-20" />
              {[1, 2].map((j) => (
                <Skeleton key={j} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <DoorOpen className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{t.classrooms.noClassrooms}</h3>
        <p className="text-muted-foreground text-center max-w-sm">
          {t.classrooms.noClassroomsDesc}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ClassroomsView() {
  const t = useT();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{ open: boolean; classroom: Classroom | null }>({
    open: false,
    classroom: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; classroom: Classroom | null }>({
    open: false,
    classroom: null,
  });
  const [addDialog, setAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Overdue payments state
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [overdueClassroom, setOverdueClassroom] = useState<Classroom | null>(null);
  const [overdueData, setOverdueData] = useState<OverdueData | null>(null);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formCapacity, setFormCapacity] = useState(20);

  const fetchClassrooms = async () => {
    try {
      const res = await fetch('/api/classrooms');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setClassrooms(data);
    } catch {
      toast.error(t.classrooms.fetchError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  // ── Overdue payments logic ────────────────────────────────────────────

  const fetchOverduePayments = useCallback(async (classroomId: string) => {
    setOverdueLoading(true);
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/overdue`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOverdueData(data);
    } catch {
      toast.error(t.classrooms.overdueFetchError);
    } finally {
      setOverdueLoading(false);
    }
  }, [t]);

  const handleOpenOverdue = (classroom: Classroom) => {
    setOverdueClassroom(classroom);
    setOverdueOpen(true);
    setOverdueData(null);
    fetchOverduePayments(classroom.id);
  };

  const handleCloseOverdue = () => {
    setOverdueOpen(false);
    setOverdueClassroom(null);
    setOverdueData(null);
  };

  const handleCreateInvoiceForStudent = async (student: OverdueStudent) => {
    const now = new Date();
    const currentMonth = MONTH_KEYS[now.getMonth()];
    const currentYear = now.getFullYear();

    setCreatingInvoice(student.studentId);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.studentId,
          amount: student.monthlyFee,
          paidAmount: 0,
          discount: 0,
          packMonths: 1,
          month: currentMonth,
          year: currentYear,
          paymentDate: null,
          method: 'cash',
          notes: '',
          status: 'pending',
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      toast.success(t.payments.invoiceCreatedQuick);
      // Refresh overdue data
      if (overdueClassroom) {
        fetchOverduePayments(overdueClassroom.id);
      }
    } catch {
      toast.error(t.common.saveError);
    } finally {
      setCreatingInvoice(null);
    }
  };

  // ── CRUD logic ────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormName('');
    setFormNameAr('');
    setFormCapacity(20);
  };

  const openEdit = (classroom: Classroom) => {
    setFormName(classroom.name);
    setFormNameAr(classroom.nameAr);
    setFormCapacity(classroom.capacity);
    setEditDialog({ open: true, classroom });
  };

  const openAdd = () => {
    resetForm();
    setAddDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formNameAr.trim()) {
      toast.error(t.classrooms.fieldsRequired);
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        nameAr: formNameAr.trim(),
        capacity: Number(formCapacity) || 20,
      };

      if (editDialog.classroom) {
        // Update
        const res = await fetch(`/api/classrooms/${editDialog.classroom.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success(t.classrooms.updateSuccess);
        setEditDialog({ open: false, classroom: null });
      } else {
        // Create
        const res = await fetch('/api/classrooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create');
        toast.success(t.classrooms.addSuccess);
        setAddDialog(false);
      }

      resetForm();
      await fetchClassrooms();
    } catch {
      toast.error(t.common.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.classroom) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/classrooms/${deleteDialog.classroom.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(t.classrooms.deleteSuccess);
      setDeleteDialog({ open: false, classroom: null });
      await fetchClassrooms();
    } catch {
      toast.error(t.common.deleteError);
    } finally {
      setSaving(false);
    }
  };

  const todayStr = getTodayDayOfWeek();

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t.classrooms.title}</h2>
            <p className="text-sm text-muted-foreground">{t.classrooms.subtitle}</p>
          </div>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          {t.classrooms.addClassroom}
        </Button>
      </div>

      {classrooms.length === 0 && <EmptyState t={t} />}

      {/* Classroom Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {classrooms.map((classroom, index) => {
          const colorSet = CLASSROOM_COLORS[index % CLASSROOM_COLORS.length];
          const todaySchedules = classroom.schedules.filter((s) => s.dayOfWeek === todayStr);
          todaySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <Card
              key={classroom.id}
              className={cn(
                'border-2 transition-all hover:shadow-md',
                colorSet.border
              )}
            >
              {/* Color bar */}
              <div className={cn('h-1.5 rounded-t-lg', colorSet.accent)} />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorSet.bg)}>
                      <DoorOpenIcon className={cn('w-5 h-5', colorSet.text)} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{classroom.nameAr}</CardTitle>
                      <p className="text-xs text-muted-foreground">{classroom.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                      onClick={() => handleOpenOverdue(classroom)}
                      title={t.classrooms.overduePayments || 'المدفوعات المستحقة'}
                    >
                      <Wallet className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(classroom)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, classroom })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={cn('rounded-lg p-3 text-center', colorSet.bg)}>
                    <Users className={cn('w-5 h-5 mx-auto mb-1', colorSet.text)} />
                    <p className="text-lg font-bold">{classroom.capacity}</p>
                    <p className="text-xs text-muted-foreground">{t.classrooms.capacity}</p>
                  </div>
                  <div className={cn('rounded-lg p-3 text-center', colorSet.bg)}>
                    <Calendar className={cn('w-5 h-5 mx-auto mb-1', colorSet.text)} />
                    <p className="text-lg font-bold">{classroom.schedules.length}</p>
                    <p className="text-xs text-muted-foreground">{t.classrooms.sessionsCount}</p>
                  </div>
                </div>

                {/* Today's Schedule */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {t.classrooms.todaySessions} ({t.days[todayStr as keyof typeof t.days]})
                    </p>
                  </div>
                  {todaySchedules.length === 0 ? (
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">{t.classrooms.noTodaySessions}</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-48">
                      <div className="space-y-2">
                        {todaySchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className={cn('rounded-lg border p-3 text-sm', colorSet.border)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{schedule.subject.nameAr}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {schedule.startTime} - {schedule.endTime}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {schedule.teacher && (
                                <span>👨‍🏫 {schedule.teacher.fullName}</span>
                              )}
                              {schedule.level && (
                                <span>📊 {schedule.level.nameAr}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          OVERDUE PAYMENTS DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={overdueOpen} onOpenChange={(open) => { if (!open) handleCloseOverdue(); }}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="shrink-0 px-6 pt-6 pb-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-t-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                {t.payments.overdue}
              </DialogTitle>
              <DialogDescription className="text-red-600/80 text-sm">
                {t.classrooms.overdueDialogDesc}
              </DialogDescription>
            </DialogHeader>

            {/* Summary bar */}
            {!overdueLoading && overdueData && overdueData.studentCount > 0 && (
              <div className="mt-3 flex items-center justify-between bg-white/80 rounded-lg px-4 py-2.5 border border-red-100">
                <div>
                  <span className="text-xs text-muted-foreground">{t.classrooms.unpaidCount}:</span>
                  <span className="font-bold text-red-600 mx-1">{overdueData.studentCount}</span>
                  <span className="text-xs text-muted-foreground">{t.common.dh}</span>
                </div>
                <div className="text-left">
                  <span className="text-xs text-muted-foreground">{t.classrooms.totalOverdue}:</span>
                  <span className="font-bold text-red-700 mx-1 text-lg">
                    {overdueData.totalOverdue.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.common.dh}</span>
                </div>
              </div>
            )}
          </div>

          {/* Student list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {overdueLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                <p className="text-sm text-muted-foreground">{t.common.loading}</p>
              </div>
            ) : overdueData && overdueData.students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="font-medium text-emerald-700">{t.classrooms.allPaid}</p>
                <p className="text-sm text-muted-foreground">{t.classrooms.allPaidDesc}</p>
              </div>
            ) : overdueData ? (
              <div className="space-y-3">
                {overdueData.students.map((student) => (
                  <div
                    key={student.studentId}
                    className="rounded-xl border border-red-100 bg-white p-4 hover:shadow-sm transition-shadow"
                  >
                    {/* Top row: Student info + Add Invoice Button */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Student name */}
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-red-400 shrink-0" />
                          <p className="font-semibold text-sm truncate">{student.studentName}</p>
                          <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px] px-1.5 py-0 shrink-0">
                            {student.monthsOverdue} {t.classrooms.monthsLabel}
                          </Badge>
                        </div>

                        {/* Phone */}
                        {student.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{student.phone}</span>
                          </div>
                        )}

                        {/* Level & Subject */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <span className="bg-slate-100 px-2 py-0.5 rounded">{student.levelName}</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded">{student.subjectName}</span>
                        </div>
                      </div>

                      {/* RED Add Invoice Button */}
                      <Button
                        onClick={() => handleCreateInvoiceForStudent(student)}
                        disabled={creatingInvoice === student.studentId}
                        className="bg-red-600 hover:bg-red-700 text-white shrink-0 gap-1.5 h-9 px-3 text-xs font-semibold"
                      >
                        {creatingInvoice === student.studentId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        {t.classrooms.addInvoice}
                      </Button>
                    </div>

                    {/* Bottom row: Amount + Due Date */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        {/* Amount */}
                        <div>
                          <span className="text-[10px] text-muted-foreground">{t.classrooms.overdueAmount}</span>
                          <p className="text-red-600 font-bold text-base">
                            {student.totalOverdue.toLocaleString()}{' '}
                            <span className="text-xs font-normal">{t.common.dh}</span>
                          </p>
                        </div>
                      </div>

                      {/* Due Date */}
                      {student.nextDueDate && (
                        <div className="text-left flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
                          <div>
                            <span className="text-[10px] text-muted-foreground">{t.classrooms.dueDate}</span>
                            <p className="text-amber-700 font-semibold text-xs" dir="ltr">
                              {student.nextDueDate}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pending payment warning */}
                    {student.hasPendingPayment && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
                        <AlertTriangle className="w-3 h-3" />
                        {t.classrooms.pendingExists}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-3 border-t bg-gray-50/50 rounded-b-lg">
            <Button
              variant="outline"
              onClick={handleCloseOverdue}
              className="w-full"
            >
              {t.common.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog
        open={editDialog.open || addDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialog({ open: false, classroom: null });
            setAddDialog(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editDialog.classroom ? t.classrooms.editClassroom : t.classrooms.addNew}
            </DialogTitle>
            <DialogDescription>
              {editDialog.classroom
                ? t.classrooms.editDesc
                : t.classrooms.addDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="classroom-name">{t.classrooms.nameAr}</Label>
              <Input
                id="classroom-name"
                placeholder={t.classrooms.nameArPlaceholder}
                value={formNameAr}
                onChange={(e) => setFormNameAr(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classroom-name-fr">{t.classrooms.nameFr}</Label>
              <Input
                id="classroom-name-fr"
                placeholder={t.classrooms.nameFrPlaceholder}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classroom-capacity">{t.classrooms.capacityLabel}</Label>
              <Input
                id="classroom-capacity"
                type="number"
                min={1}
                value={formCapacity}
                onChange={(e) => setFormCapacity(Number(e.target.value))}
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialog({ open: false, classroom: null });
                setAddDialog(false);
                resetForm();
              }}
              disabled={saving}
            >
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t.common.saving : t.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, classroom: open ? deleteDialog.classroom : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t.common.deleteConfirm}
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف القاعة &quot;{deleteDialog.classroom?.nameAr}&quot;؟
              {deleteDialog.classroom && deleteDialog.classroom.schedules.length > 0 && (
                <span className="block mt-2 font-medium text-destructive">
                  ⚠️ تحذير: هذه القاعة تحتوي على {deleteDialog.classroom.schedules.length} حصة دراسية. سيتم التأثير على الجدول الزمني.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {saving ? t.common.loading : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
