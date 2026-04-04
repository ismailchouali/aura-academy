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

interface AppState {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
}));
