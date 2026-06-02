'use client';

import { Moon, Sun } from 'lucide-react';

import { TopBar } from '@/components/layout/TopBar';
import { useThemeStore } from '@/store/themeStore';

export default function CajaLayout({ children }: { children: React.ReactNode }) {
  const { cajaIsDark, toggleCajaTheme } = useThemeStore();

  const toggleBtn = (
    <button
      onClick={toggleCajaTheme}
      title={cajaIsDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
    >
      {cajaIsDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );

  return (
    <div
      className="flex h-screen flex-col overflow-hidden transition-colors duration-200"
      style={{ background: cajaIsDark ? '#09090e' : '#f8fafc' }}
    >
      <TopBar showHamburger rightExtra={toggleBtn} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
