import { create } from 'zustand';

export type ViewType =
  | 'dashboard'
  | 'students'
  | 'teachers'
  | 'payments'
  | 'teacher-payments'
  | 'schedule'
  | 'services'
  | 'classrooms'
  | 'settings';

export type Lang = 'ar' | 'fr';

interface AppState {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  lang: 'ar',
  setLang: (lang) => set({ lang }),
  toggleLang: () =>
    set((state) => ({ lang: state.lang === 'ar' ? 'fr' : 'ar' })),
}));
