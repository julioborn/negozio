'use client';

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id:       string;
  type:     ToastType;
  message:  string;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add:    (t: Omit<ToastItem, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (t) =>
    set((s) => ({
      toasts: [...s.toasts, { ...t, id: crypto.randomUUID() }],
    })),
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const add = useToastStore((s) => s.add);

  return {
    success: (message: string, duration = 3000) =>
      add({ type: 'success', message, duration }),
    error: (message: string, duration = 5000) =>
      add({ type: 'error', message, duration }),
    warning: (message: string, duration = 4000) =>
      add({ type: 'warning', message, duration }),
    info: (message: string, duration = 3000) =>
      add({ type: 'info', message, duration }),
  };
}
