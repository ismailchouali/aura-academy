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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

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

const DEFAULT_SETTINGS: SettingsData = {
  center_name: 'Aura Academy',
  center_phone: '0606030356',
  center_address: 'بني ملال، شارع محمد الخامس، أمام مؤسسة أبي القاسم الصومعي، فوق مكتبة وورك بيرو، الطابق الثالث',
  center_open_time: '11:00',
  center_close_time: '22:30',
  center_open_days: 'الأحد - الجمعة',
  currency: 'MAD',
};

const FORM_FIELDS = [
  {
    key: 'center_name',
    label: 'اسم المركز',
    placeholder: 'Aura Academy',
    icon: Building2,
    dir: 'rtl' as const,
  },
  {
    key: 'center_phone',
    label: 'رقم الهاتف',
    placeholder: '0606030356',
    icon: Phone,
    dir: 'ltr' as const,
  },
  {
    key: 'center_address',
    label: 'العنوان',
    placeholder: 'بني ملال، شارع محمد الخامس...',
    icon: MapPin,
    dir: 'rtl' as const,
  },
  {
    key: 'center_open_time',
    label: 'ساعة الافتتاح',
    placeholder: '11:00',
    icon: Clock,
    dir: 'ltr' as const,
  },
  {
    key: 'center_close_time',
    label: 'ساعة الإغلاق',
    placeholder: '22:30',
    icon: Clock,
    dir: 'ltr' as const,
  },
  {
    key: 'center_open_days',
    label: 'أيام العمل',
    placeholder: 'الأحد - الجمعة',
    icon: CalendarDays,
    dir: 'rtl' as const,
  },
  {
    key: 'currency',
    label: 'العملة',
    placeholder: 'MAD',
    icon: Coins,
    dir: 'ltr' as const,
  },
];

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

export function SettingsView() {
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
      toast.error('فشل في تحميل الإعدادات');
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
      toast.success('تم حفظ الإعدادات بنجاح');
      setHasChanges(false);
    } catch {
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
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
          <h2 className="text-2xl font-bold">إعدادات المركز</h2>
          <p className="text-sm text-muted-foreground">إدارة المعلومات الأساسية للمركز</p>
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
          <CardTitle className="text-lg">المعلومات الأساسية</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {FORM_FIELDS.map((field, index) => {
            const Icon = field.icon;
            return (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor={field.key}>{field.label}</Label>
                </div>
                <Input
                  id={field.key}
                  value={settings[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  dir={field.dir}
                  className={cn(
                    field.key === 'center_address' && 'text-sm'
                  )}
                />
                {index < FORM_FIELDS.length - 1 && <Separator className="mt-5" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        {!hasChanges && (
          <p className="text-sm text-muted-foreground self-center">لا توجد تغييرات</p>
        )}
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="gap-2 min-w-[140px]"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              حفظ الإعدادات
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
