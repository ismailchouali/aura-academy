'use client';

import { useAppStore } from '@/store/store';
import { translations, Translations } from '@/lib/translations';

/**
 * Hook to get translations based on current language from the store.
 * Usage:
 *   const t = useT();
 *   <p>{t.common.cancel}</p>
 */
export function useT(): Translations {
  const lang = useAppStore((s) => s.lang);
  return translations[lang];
}
