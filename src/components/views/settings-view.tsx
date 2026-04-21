'use client';

import { useEffect, useState } from 'react';
import {
  Settings,
  Save,
  Building2,
  Phone,
  MapPin,
  Clock,
  CalendarDays,
  Coins,
  Loader2,
  Sparkles,
  DatabaseBackup,
  Download,
  RotateCcw,
  Trash2,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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

interface SettingsData {
  center_name: string;
  center_phone: string;
  center_address: string;
  center_open_time: string;
  center_close_time: string;
  center_open_days: string;
  currency: string;
  [key: string]: string;
}

interface BackupInfo {
  filename: string;
  size: number;
  sizeHuman: string;
  createdAt: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  center_name: 'Aura Academy',
  center_phone: '0606030356',
  center_address: 'بني ملال، شارع محمد الخامس، أمام مؤسسة أبي القاسم الصومعي، فوق مكتبة وورك بيرو، الطابق الثالث',
  center_open_time: '11:00',
  center_close_time: '22:30',
  center_open_days: 'الأحد - الجمعة',
  currency: 'MAD',
};

const FORM_FIELD_KEYS = ['center_name', 'center_phone', 'center_address', 'center_open_time', 'center_close_time', 'center_open_days', 'currency'] as const;

const SETTINGS_LABEL_MAP: Record<string, string> = {
  center_name: 'centerName',
  center_phone: 'centerPhone',
  center_address: 'centerAddress',
  center_open_time: 'openTime',
  center_close_time: 'closeTime',
  center_open_days: 'openDays',
  currency: 'currency',
};

const FORM_FIELD_ICONS: Record<string, React.ElementType> = {
  center_name: Building2,
  center_phone: Phone,
  center_address: MapPin,
  center_open_time: Clock,
  center_close_time: Clock,
  center_open_days: CalendarDays,
  currency: Coins,
};

const FORM_FIELD_DIRS: Record<string, 'rtl' | 'ltr'> = {
  center_name: 'rtl',
  center_phone: 'ltr',
  center_address: 'rtl',
  center_open_time: 'ltr',
  center_close_time: 'ltr',
  center_open_days: 'rtl',
  currency: 'ltr',
};

const FORM_FIELD_PLACEHOLDERS: Record<string, string> = {
  center_name: 'Aura Academy',
  center_phone: '0606030356',
  center_address: 'بني ملال، شارع محمد الخامس...',
  center_open_time: '11:00',
  center_close_time: '22:30',
  center_open_days: 'الأحد - الجمعة',
  currency: 'MAD',
};

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
      <Card>
        <CardContent className="p-6 space-y-6">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function BackupSection() {
  const { lang } = useAppStore();
  const isAr = lang === 'ar';
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) return;
      const data = await res.json();
      setBackups(data.backups || []);
    } catch {
      // ignore
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/backup', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(isAr ? `✅ تم إنشاء نسخة احتياطية (${data.sizeHuman})` : `✅ Sauvegarde créée (${data.sizeHuman})`);
      fetchBackups();
    } catch {
      toast.error(isAr ? 'فشل إنشاء النسخة الاحتياطية' : 'Échec de la sauvegarde');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (!res.ok) throw new Error();
      toast.success(isAr ? '✅ تم استعادة النسخة الاحتياطية' : '✅ Sauvegarde restaurée');
    } catch {
      toast.error(isAr ? 'فشل استعادة النسخة الاحتياطية' : 'Échec de la restauration');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <DatabaseBackup className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-lg">
            {isAr ? 'النسخ الاحتياطي' : 'Sauvegarde'}
          </CardTitle>
        </div>
        <CardDescription>
          {isAr
            ? 'إنشاء نسخ احتياطية لقاعدة البيانات واستعادتها'
            : 'Créer et restaurer des sauvegardes de la base de données'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Create Backup Button */}
        <Button
          onClick={handleCreateBackup}
          disabled={creating}
          className="w-full gap-2 bg-blue-600 hover:bg-blue-700 cursor-pointer"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <DatabaseBackup className="w-4 h-4" />
          )}
          {isAr ? 'إنشاء نسخة احتياطية الآن' : 'Créer une sauvegarde maintenant'}
        </Button>

        {/* Backups List */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {isAr ? `النسخ الاحتياطية (${backups.length})` : `Sauvegardes (${backups.length})`}
          </p>
          {loadingBackups ? (
            <Skeleton className="h-12 w-full" />
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isAr ? 'لا توجد نسخ احتياطية بعد' : 'Aucune sauvegarde disponible'}
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" dir="ltr">
                      {backup.filename.replace('aura-backup-', '').replace('.db', '')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(backup.createdAt)} · {backup.sizeHuman}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 shrink-0 ms-2 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {isAr ? 'استعادة' : 'Restaurer'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {isAr ? 'تأكيد الاستعادة' : 'Confirmer la restauration'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {isAr
                            ? 'سيتم استبدال جميع البيانات الحالية بهذه النسخة الاحتياطية. هل أنت متأكد؟'
                            : 'Toutes les données actuelles seront remplacées par cette sauvegarde. Êtes-vous sûr ?'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{isAr ? 'إلغاء' : 'Annuler'}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRestore(backup.filename)}
                          className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
                        >
                          {isAr ? 'نعم، استعادة' : 'Oui, restaurer'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SecuritySection() {
  const { lang } = useAppStore();
  const isAr = lang === 'ar';

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          <CardTitle className="text-lg">
            {isAr ? 'الأمان' : 'Sécurité'}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {[
          { label: isAr ? 'تشفير كلمات المرور' : 'Hachage des mots de passe', value: 'PBKDF2-SHA512', ok: true },
          { label: isAr ? 'حماية الجلسات' : 'Protection des sessions', value: 'HttpOnly Cookie', ok: true },
          { label: isAr ? 'تحديد المحاولات' : 'Limitation des tentatives', value: isAr ? '10 محاولات / 15 دقيقة' : '10 tentatives / 15 min', ok: true },
          { label: isAr ? 'التحقق من المدخلات' : 'Validation des entrées', value: '✓', ok: true },
          { label: isAr ? 'حماية المسارات' : 'Protection des routes', value: isAr ? 'Middleware' : 'Middleware', ok: true },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <span className="text-sm">{item.label}</span>
            <span className={cn('text-xs px-2 py-1 rounded-full font-medium', item.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')} dir="ltr">
              {item.value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  const t = useT();
  const { isAdmin } = useAppStore();
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const merged: SettingsData = { ...DEFAULT_SETTINGS };
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          merged[key] = value;
        }
      }
      setSettings(merged);
    } catch {
      toast.error(t.settings.fetchError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(t.settings.saveSuccess);
      setHasChanges(false);
    } catch {
      toast.error(t.settings.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{t.settings.title}</h2>
          <p className="text-sm text-muted-foreground">{t.settings.subtitle}</p>
        </div>
      </div>

      {/* Branding Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-amber-500 to-orange-600 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">{settings.center_name || 'Aura Academy'}</h3>
              <p className="text-white/80 text-sm">{settings.center_address || 'بني ملال'}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-4 text-sm text-white/90">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span dir="ltr">{settings.center_phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span dir="ltr">{settings.center_open_time} - {settings.center_close_time}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Settings Form */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t.settings.basicInfo}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {FORM_FIELD_KEYS.map((key, index) => {
            const Icon = FORM_FIELD_ICONS[key];
            const labelKey = SETTINGS_LABEL_MAP[key] || key;
            const label = (t.settings as Record<string, string>)[labelKey] || key;
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor={key}>{label}</Label>
                </div>
                <Input
                  id={key}
                  value={settings[key] || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={FORM_FIELD_PLACEHOLDERS[key]}
                  dir={FORM_FIELD_DIRS[key]}
                  className={cn(
                    key === 'center_address' && 'text-sm'
                  )}
                />
                {index < FORM_FIELD_KEYS.length - 1 && <Separator className="mt-5" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        {!hasChanges && (
          <p className="text-sm text-muted-foreground self-center">{t.common.noChanges}</p>
        )}
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="gap-2 min-w-[140px]"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.common.saving}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {t.settings.saveSettings}
            </>
          )}
        </Button>
      </div>

      {/* Backup Section - Admin Only */}
      {isAdmin && <BackupSection />}

      {/* Security Info */}
      <SecuritySection />
    </div>
  );
}
