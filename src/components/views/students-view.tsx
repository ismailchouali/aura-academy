'use client';

import { useEffect, useState, useCallback } from 'react';
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
  UserCheck,
  GraduationCap,
  Wallet,
  Loader2,
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
    subject: { name: string; nameAr: string; service?: { nameAr: string } };
  } | null;
  teacherId: string | null;
  teacher: { id: string; fullName: string } | null;
  parentName: string | null;
  parentPhone: string | null;
  monthlyFee: number;
  status: string;
  enrollmentDate: string;
  payments: unknown[];
}

interface FormState {
  fullName: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  monthlyFee: string;
}

const initialForm: FormState = {
  fullName: '',
  phone: '',
  parentName: '',
  parentPhone: '',
  monthlyFee: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────

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

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
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

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchStudents();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Dialog open / close ───────────────────────────────────────────────

  const handleOpenDialog = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setForm({
        fullName: student.fullName,
        phone: student.phone || '',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        monthlyFee: student.monthlyFee ? String(student.monthlyFee) : '',
      });
    } else {
      setEditingStudent(null);
      setForm({ ...initialForm });
    }
    setDialogOpen(true);
  };

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      toast.error('يرجى إدخال اسم التلميذ');
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
          monthlyFee: student.monthlyFee,
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
                    <TableHead className="text-right hidden sm:table-cell">القسط</TableHead>
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
                          <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold shrink-0">
                            {student.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{student.fullName}</p>
                            {student.parentName && (
                              <p className="text-xs text-muted-foreground truncate">ولي: {student.parentName}</p>
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
                      <TableCell className="text-right hidden sm:table-cell">
                        {student.monthlyFee > 0 ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium">
                            {student.monthlyFee.toLocaleString('ar-MA')} درهم
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
          ADD / EDIT DIALOG — SIMPLIFIED FORM
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-lg flex flex-col p-0 gap-0 overflow-hidden max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingStudent ? 'تعديل بيانات التلميذ' : 'إضافة تلميذ جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingStudent ? 'قم بتعديل بيانات التلميذ أدناه' : 'أدخل بيانات التلميذ الجديد'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
            {/* ── Personal Info ─────────────────────────────────────────── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-teal-600" />
                المعلومات الشخصية
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="fullName">
                    الاسم الكامل <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder="الاسم الكامل للتلميذ"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="phone">الهاتف</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="رقم الهاتف"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* ── Parent Info ───────────────────────────────────────────── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-600" />
                معلومات الولي
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="parentName">اسم الولي</Label>
                  <Input
                    id="parentName"
                    value={form.parentName}
                    onChange={(e) => setForm((prev) => ({ ...prev, parentName: e.target.value }))}
                    placeholder="اسم ولي الأمر"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="parentPhone">هاتف الولي</Label>
                  <Input
                    id="parentPhone"
                    value={form.parentPhone}
                    onChange={(e) => setForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
                    placeholder="رقم هاتف ولي الأمر"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* ── Monthly Fee ───────────────────────────────────────────── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-amber-600" />
                القسط الشهري
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="monthlyFee">المبلغ (درهم)</Label>
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
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <div className="flex items-center justify-end gap-2">
              {editingStudent && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" className="text-destructive hover:text-destructive gap-1">
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                      <AlertDialogDescription>
                        هل أنت متأكد من حذف التلميذ &quot;{editingStudent.fullName}&quot;؟ لا يمكن التراجع عن هذا الإجراء.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          handleDelete(editingStudent.id);
                          setDialogOpen(false);
                        }}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        حذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !form.fullName.trim()}
                className="gap-1"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingStudent ? 'حفظ التعديلات' : 'إضافة التلميذ'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
