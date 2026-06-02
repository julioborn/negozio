import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  cajaIsDark: boolean;
  toggleCajaTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      cajaIsDark: true,
      toggleCajaTheme: () => set((s) => ({ cajaIsDark: !s.cajaIsDark })),
    }),
    { name: 'negozio-theme' }
  )
);
