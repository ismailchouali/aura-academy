'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
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
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// ScrollArea removed - using overflow-y-auto for reliable footer visibility
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ShieldCheck,
  Shield,
  UserCog,
  Users,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'SECRETARY';
  status: 'active' | 'inactive';
  accessPages: string;
  createdAt: string;
}

interface UserFormData {
  fullName: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'SECRETARY';
  status: 'active' | 'inactive';
  accessPages: string[];
}

interface AccessPage {
  id: string;
  label: string;
  icon: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ALL_PAGES: AccessPage[] = [
  { id: 'dashboard', label: 'الصفحة الرئيسية', icon: 'LayoutDashboard' },
  { id: 'financial-reports', label: 'التقارير المالية', icon: 'TrendingUp' },
  { id: 'students', label: 'الطلاب', icon: 'Users' },
  { id: 'teachers', label: 'المدرسين', icon: 'GraduationCap' },
  { id: 'payments', label: 'الأقساط', icon: 'Receipt' },
  { id: 'teacher-payments', label: 'مداخيل الأساتذة', icon: 'Wallet' },
  { id: 'schedule', label: 'الجدول الزمني', icon: 'CalendarDays' },
  { id: 'services', label: 'الخدمات', icon: 'BookOpen' },
  { id: 'classrooms', label: 'القاعات', icon: 'DoorOpen' },
  { id: 'settings', label: 'الإعدادات', icon: 'Settings' },
];

const ALL_PAGE_IDS = ALL_PAGES.map((p) => p.id);

const defaultFormData: UserFormData = {
  fullName: '',
  email: '',
  password: '',
  role: 'SECRETARY',
  status: 'active',
  accessPages: [],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day} / ${month} / ${year}`;
}

function parseAccessPages(accessPages: string): string[] {
  if (!accessPages) return [];
  return accessPages.split(',').map((p) => p.trim()).filter(Boolean);
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function UsersView() {
  // ── State ───────────────────────────────────────────────────────────────

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setUsers(json);
    } catch {
      toast.error('فشل في تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Filtered users ─────────────────────────────────────────────────────

  const filteredUsers = users.filter((user) => {
    if (!searchQuery || searchQuery.length < 1) return true;
    const q = searchQuery.toLowerCase();
    return (
      (user.fullName || '').toLowerCase().includes(q) ||
      (user.email || '').toLowerCase().includes(q)
    );
  });

  // ── Badge helpers ──────────────────────────────────────────────────────

  const getRoleBadge = (role: string) => {
    if (role === 'ADMIN') {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
          <ShieldCheck className="h-3 w-3 ml-1" />
          مدير
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
        <Shield className="h-3 w-3 ml-1" />
        سكرتير
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
          نشط
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        معطل
      </Badge>
    );
  };

  // ── Access pages helpers ───────────────────────────────────────────────

  const toggleAccessPage = (pageId: string) => {
    setFormData((prev) => {
      if (prev.role === 'ADMIN') return prev;
      const pages = prev.accessPages.includes(pageId)
        ? prev.accessPages.filter((p) => p !== pageId)
        : [...prev.accessPages, pageId];
      return { ...prev, accessPages: pages };
    });
  };

  const selectAllPages = () => {
    if (formData.role === 'ADMIN') return;
    setFormData((prev) => ({
      ...prev,
      accessPages: prev.accessPages.length === ALL_PAGE_IDS.length ? [] : [...ALL_PAGE_IDS],
    }));
  };

  // ── Form handling ──────────────────────────────────────────────────────

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        fullName: user.fullName,
        email: user.email,
        password: '',
        role: user.role,
        status: user.status,
        accessPages: user.role === 'ADMIN' ? [...ALL_PAGE_IDS] : parseAccessPages(user.accessPages),
      });
    } else {
      setEditingUser(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      toast.error('يرجى إدخال الاسم الكامل');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }
    if (!editingUser && !formData.password.trim()) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        role: formData.role,
        status: formData.status,
        accessPages: formData.role === 'ADMIN' ? ALL_PAGE_IDS.join(',') : formData.accessPages.join(','),
      };

      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(editingUser ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح');
      setDialogOpen(false);
      fetchUsers();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success('تم حذف المستخدم بنجاح');
      setDeleteOpen(false);
      setDeletingUser(null);
      fetchUsers();
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  // ── Handle role change in form ─────────────────────────────────────────

  const handleRoleChange = (role: 'ADMIN' | 'SECRETARY') => {
    setFormData((prev) => ({
      ...prev,
      role,
      accessPages: role === 'ADMIN' ? [...ALL_PAGE_IDS] : [],
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-5 w-5" />
          <span className="text-sm">{users.length} مستخدم</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="البحث بالاسم أو البريد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            إضافة مستخدم
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المستخدمين</p>
            <p className="text-lg font-bold mt-1">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">المديرون</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">
              {users.filter((u) => u.role === 'ADMIN').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">السكرتارية</p>
            <p className="text-lg font-bold text-blue-600 mt-1">
              {users.filter((u) => u.role === 'SECRETARY').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">المستخدمون النشطون</p>
            <p className="text-lg font-bold text-teal-600 mt-1">
              {users.filter((u) => u.status === 'active').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCog className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">
                {searchQuery ? 'لا توجد نتائج للبحث' : 'لا يوجد مستخدمون بعد'}
              </p>
              <p className="text-sm mt-1">
                {searchQuery ? 'جرب البحث بكلمات أخرى' : 'أضف أول مستخدم للبدء'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الدور</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">الحالة</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                              user.role === 'ADMIN'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {user.role === 'ADMIN' ? (
                              <ShieldCheck className="h-4 w-4" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </div>
                          <p className="font-medium text-sm">{user.fullName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground" dir="ltr">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {getStatusBadge(user.status)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingUser(user);
                              setDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
          ADD / EDIT USER DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>
              {editingUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'قم بتعديل بيانات المستخدم والصلاحيات المطلوبة'
                : 'أدخل بيانات المستخدم الجديد وحدد صلاحياته'}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
            <div className="grid gap-5">
              {/* ── Full Name ─────────────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">الاسم الكامل</Label>
                <Input
                  placeholder="أدخل الاسم الكامل"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                />
              </div>

              {/* ── Email ─────────────────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">البريد الإلكتروني</Label>
                <Input
                  type="email"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  dir="ltr"
                  className="text-left"
                />
              </div>

              {/* ── Password ──────────────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">كلمة المرور</Label>
                <Input
                  type="password"
                  placeholder={editingUser ? 'اتركه فارغاً للحفاظ على كلمة المرور الحالية' : 'أدخل كلمة المرور'}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                  dir="ltr"
                  className="text-left"
                />
                {editingUser && (
                  <p className="text-xs text-muted-foreground">
                    اتركه فارغاً للحفاظ على كلمة المرور الحالية
                  </p>
                )}
              </div>

              {/* ── Role & Status ─────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">الدور</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(val) => handleRoleChange(val as 'ADMIN' | 'SECRETARY')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          مدير
                        </span>
                      </SelectItem>
                      <SelectItem value="SECRETARY">
                        <span className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-600" />
                          سكرتير
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">الحالة</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, status: val as 'active' | 'inactive' }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="inactive">معطل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Access Pages ───────────────────────────────────────── */}
              <div className="space-y-3">
                <Separator />
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">صفحات الوصول</Label>
                  {formData.role !== 'ADMIN' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={selectAllPages}
                    >
                      {formData.accessPages.length === ALL_PAGE_IDS.length
                        ? 'إلغاء تحديد الكل'
                        : 'تحديد الكل'}
                    </Button>
                  )}
                </div>

                {formData.role === 'ADMIN' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-sm text-emerald-700">
                      <ShieldCheck className="h-4 w-4 inline ml-1.5" />
                      المدير لديه صلاحية الوصول الكامل لجميع الصفحات تلقائياً
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_PAGES.map((page) => {
                    const isChecked =
                      formData.role === 'ADMIN' || formData.accessPages.includes(page.id);
                    const isDisabled = formData.role === 'ADMIN';

                    return (
                      <label
                        key={page.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-card hover:bg-accent/50 border-border'
                        } ${isDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={isDisabled}
                          onCheckedChange={() => toggleAccessPage(page.id)}
                        />
                        <span className="text-sm font-medium">{page.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t px-6 py-4 bg-muted/30 flex flex-col-reverse sm:flex-row items-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-2 min-w-[120px]"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  جاري الحفظ...
                </>
              ) : editingUser ? (
                <>
                  <Pencil className="h-4 w-4" />
                  حفظ التعديلات
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  إضافة المستخدم
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              تأكيد حذف المستخدم
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right leading-relaxed pt-2">
              هل أنت متأكد من حذف المستخدم{' '}
              <span className="font-bold text-foreground">{deletingUser?.fullName}</span>
              ؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-start mt-4">
            <AlertDialogCancel className="m-0">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90 m-0 gap-2"
            >
              <Trash2 className="h-4 w-4" />
              نعم، حذف المستخدم
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
