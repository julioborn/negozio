import type { Metadata } from 'next';

import { TopBar } from '@/components/layout/TopBar';

export const metadata: Metadata = { title: 'Empleados | Negozio' };

export default function EmpleadosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar showHamburger />
      {children}
    </div>
  );
}
