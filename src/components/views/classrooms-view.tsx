'use client';

import { useEffect, useState } from 'react';
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
  FileText,
  X,
  Phone,
  User,
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
  overduePayments: {
    id: string;
    month: string;
    monthLabel: string;
    year: number;
    remainingAmount: number;
    monthsOverdue: number;
  }[];
}

interface ClassroomOverdueData {
  classroomId: string;
  classroomName: string;
  students: OverdueStudent[];
  totalOverdue: number;
  studentCount: number;
}

const DAY_MAP: Record<string, string> = {
  '1': 'الأحد',
  '2': 'الاثنين',
  '3': 'الثلاثاء',
  '4': 'الأربعاء',
  '5': 'الخميس',
  '6': 'الجمعة',
  '7': 'السبت',
};

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
  const [overdueDialog, setOverdueDialog] = useState<{ open: boolean; classroom: Classroom | null }>({
    open: false,
    classroom: null,
  });
  const [overdueData, setOverdueData] = useState<ClassroomOverdueData | null>(null);
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

  // ── Overdue payments handlers ──

  const handleOpenOverdue = async (classroom: Classroom) => {
    setOverdueDialog({ open: true, classroom });
    setOverdueLoading(true);
    setOverdueData(null);
    try {
      const res = await fetch(`/api/classrooms/${classroom.id}/overdue`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOverdueData(data);
    } catch {
      toast.error(t.classrooms.overdueFetchError);
    } finally {
      setOverdueLoading(false);
    }
  };

  const handleCreateInvoice = async (student: OverdueStudent) => {
    const now = new Date();
    const currentMonth = MONTH_ORDER[now.getMonth()];
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
      toast.success(t.classrooms.invoiceCreated);
      // Refresh overdue data
      if (overdueDialog.classroom) {
        await handleOpenOverdue(overdueDialog.classroom);
      }
    } catch {
      toast.error(t.common.saveError);
    } finally {
      setCreatingInvoice(null);
    }
  };

  const MONTH_ORDER = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

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
                      className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={() => handleOpenOverdue(classroom)}
                      title={t.payments.overdue}
                    >
                      <Wallet className="w-3.5 h-3.5" />
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

      {/* ═══════════════════════════════════════════════════════════════════
          OUTSTANDING PAYMENTS DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={overdueDialog.open} onOpenChange={(open) => {
        if (!open) {
          setOverdueDialog({ open: false, classroom: null });
          setOverdueData(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-amber-600" />
              </div>
              {t.payments.overdue} - {overdueDialog.classroom?.nameAr}
            </DialogTitle>
            <DialogDescription>
              {t.classrooms.overdueDialogDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
            {overdueLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
              </div>
            ) : overdueData && overdueData.students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-muted-foreground font-medium">{t.classrooms.allPaid}</p>
                <p className="text-sm text-muted-foreground">{t.classrooms.allPaidDesc}</p>
              </div>
            ) : overdueData ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <p className="text-xs text-red-600 font-medium">{t.classrooms.totalOverdue}</p>
                    <p className="text-lg font-bold text-red-700">
                      {overdueData.totalOverdue.toLocaleString()}{' '}
                      <span className="text-xs font-normal">{t.common.dh}</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 text-center">
                    <p className="text-xs text-amber-600 font-medium">{t.classrooms.unpaidCount}</p>
                    <p className="text-lg font-bold text-amber-700">
                      {overdueData.studentCount}{' '}
                      <span className="text-xs font-normal">{t.students.studentCount}</span>
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Students List */}
                <div className="space-y-3">
                  {overdueData.students.map((student) => (
                    <div
                      key={student.studentId}
                      className="rounded-lg border p-4 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{student.studentName}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {student.levelName && (
                                <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">
                                  {student.subjectName} - {student.levelName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {student.phone && (
                                <span className="flex items-center gap-1" dir="ltr">
                                  <Phone className="w-3 h-3" />
                                  {student.phone}
                                </span>
                              )}
                              {student.parentPhone && (
                                <span className="flex items-center gap-1" dir="ltr">
                                  <Phone className="w-3 h-3" />
                                  {student.parentPhone}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-red-600 font-medium">
                                {t.classrooms.overdueAmount}: {student.totalOverdue.toLocaleString()} {t.common.dh}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({student.monthsOverdue} {t.classrooms.monthsLabel})
                              </span>
                            </div>

                            {/* Show overdue payment details */}
                            {student.overduePayments.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {student.overduePayments.map((op) => (
                                  <span
                                    key={op.id}
                                    className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100"
                                  >
                                    {op.monthLabel} {op.year}: {op.remainingAmount.toLocaleString()} {t.common.dh}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Create Invoice Button */}
                        <div className="shrink-0">
                          {student.hasPendingPayment ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 whitespace-nowrap">
                              <FileText className="w-3 h-3 ml-1" />
                              {t.classrooms.pendingExists}
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white whitespace-nowrap"
                              onClick={() => handleCreateInvoice(student)}
                              disabled={creatingInvoice === student.studentId}
                            >
                              {creatingInvoice === student.studentId ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              {t.classrooms.addInvoice}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
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
