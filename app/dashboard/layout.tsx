import type { Metadata } from 'next';

import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar }  from '@/components/layout/TopBar';

export const metadata: Metadata = { title: 'Dashboard | Negozio' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-dash-bg">
      {/* Sidebar solo en desktop */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TopBar: en desktop sin hamburguesa (Sidebar lo maneja), en mobile con hamburguesa */}
        <TopBar showHamburger />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
