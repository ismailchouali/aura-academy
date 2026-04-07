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
import { useT } from '@/hooks/use-translation';
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

export function SettingsView() {
  const t = useT();
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
    </div>
  );
}
