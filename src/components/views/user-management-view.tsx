'use client';

import { useState, useEffect, useCallback } from 'react';
import { useT } from '@/hooks/use-translation';
import { useAppStore } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Shield, UserPlus, Pencil, Trash2, Loader2, Users, Mail, Key } from 'lucide-react';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function UserManagementView() {
  const t = useT();
  const { lang } = useAppStore();
  const isAr = lang === 'ar';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState('SECRETARY');
  const [formStatus, setFormStatus] = useState('active');
  const [formError, setFormError] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isAr ? 'فشل في تحميل المستخدمين' : 'Échec du chargement'));
        return;
      }
      setUsers(data.users);
    } catch {
      setError(isAr ? 'خطأ في الاتصال' : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setFormEmail('');
    setFormPassword('');
    setFormFullName('');
    setFormRole('SECRETARY');
    setFormStatus('active');
    setFormError('');
    setEditingUser(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormPassword('');
    setFormFullName(user.fullName);
    setFormRole(user.role);
    setFormStatus(user.status);
    setFormError('');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setFormError('');
    setSaving(true);

    try {
      const isEdit = !!editingUser;
      const payload: Record<string, string> = {
        email: formEmail,
        fullName: formFullName,
        role: formRole,
        status: formStatus,
      };

      if (formPassword) {
        payload.password = formPassword;
      }

      if (isEdit) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || (isAr ? 'فشل في التحديث' : 'Échec de la mise à jour'));
          return;
        }
      } else {
        if (!formPassword) {
          setFormError(isAr ? 'كلمة المرور مطلوبة' : 'Le mot de passe est requis');
          return;
        }
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || (isAr ? 'فشل في الإضافة' : 'Échec de l\'ajout'));
          return;
        }
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch {
      setFormError(isAr ? 'خطأ في الاتصال' : 'Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deletingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isAr ? 'فشل في الحذف' : 'Échec de la suppression'));
        return;
      }
      setDeleteOpen(false);
      setDeletingId(null);
      fetchUsers();
    } catch {
      setError(isAr ? 'خطأ في الاتصال' : 'Erreur de connexion');
    } finally {
      setDeleting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'ADMIN') {
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{isAr ? 'مدير' : 'Admin'}</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{isAr ? 'سكرتير' : 'Secrétaire'}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{isAr ? 'نشط' : 'Actif'}</Badge>;
    }
    return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{isAr ? 'معطل' : 'Inactif'}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {isAr ? 'إدارة الحسابات' : 'Gestion des Comptes'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? 'إدارة حسابات المديرين والسكرتارية' : 'Gérer les comptes admins et secrétaires'}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-emerald-600 hover:bg-emerald-700 cursor-pointer">
          <UserPlus className="h-4 w-4" />
          {isAr ? 'إضافة حساب' : 'Ajouter un compte'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground">{isAr ? 'إجمالي الحسابات' : 'Total comptes'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.filter(u => u.role === 'ADMIN').length}</p>
              <p className="text-xs text-muted-foreground">{isAr ? 'مديرين' : 'Admins'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.filter(u => u.role === 'SECRETARY').length}</p>
              <p className="text-xs text-muted-foreground">{isAr ? 'سكرتارية' : 'Secrétaires'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{isAr ? 'قائمة الحسابات' : 'Liste des comptes'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            {users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{isAr ? 'لا توجد حسابات' : 'Aucun compte'}</p>
              </div>
            ) : (
              <div className="divide-y">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${user.role === 'ADMIN' ? 'bg-emerald-600' : 'bg-blue-500'}`}>
                        {user.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user.status)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setDeletingId(user.id);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser
                ? (isAr ? 'تعديل الحساب' : 'Modifier le compte')
                : (isAr ? 'إضافة حساب جديد' : 'Nouveau compte')
              }
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? (isAr ? 'قم بتعديل بيانات الحساب' : 'Modifiez les informations du compte')
                : (isAr ? 'أدخل بيانات الحساب الجديد' : 'Entrez les informations du nouveau compte')
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>{isAr ? 'الاسم الكامل' : 'Nom complet'}</Label>
              <Input
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                placeholder={isAr ? 'أدخل الاسم' : 'Entrez le nom'}
              />
            </div>

            <div className="space-y-2">
              <Label>{isAr ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="example@email.com"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label>
                {isAr
                  ? (editingUser ? 'كلمة المرور (اتركها فارغة إذا لم ترد تغييرها)' : 'كلمة المرور')
                  : (editingUser ? 'Mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe')
                }
              </Label>
              <div className="relative">
                <Input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                />
                <Key className="absolute top-1/2 -translate-y-1/2 end-3 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isAr ? 'الدور' : 'Rôle'}</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">{isAr ? 'مدير' : 'Admin'}</SelectItem>
                    <SelectItem value="SECRETARY">{isAr ? 'سكرتير' : 'Secrétaire'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingUser && (
                <div className="space-y-2">
                  <Label>{isAr ? 'الحالة' : 'Statut'}</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{isAr ? 'نشط' : 'Actif'}</SelectItem>
                      <SelectItem value="inactive">{isAr ? 'معطل' : 'Inactif'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { resetForm(); setDialogOpen(false); }}
            >
              {isAr ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !formEmail || !formFullName}
              className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {editingUser
                ? (isAr ? 'حفظ التعديلات' : 'Enregistrer')
                : (isAr ? 'إضافة' : 'Ajouter')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAr ? 'تأكيد الحذف' : 'Confirmer la suppression'}</DialogTitle>
            <DialogDescription>
              {isAr
                ? 'هل أنت متأكد من حذف هذا الحساب؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'Êtes-vous sûr de vouloir supprimer ce compte ? Cette action est irréversible.'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {isAr ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="cursor-pointer"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {isAr ? 'حذف' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
