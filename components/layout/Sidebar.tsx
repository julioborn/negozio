'use client';

import { useEffect, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  BarChart3,
  BoxesIcon,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  Settings,
  ShoppingCart,
  Smartphone,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ElementType;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',                    label: 'Dashboard',     icon: BarChart3,   exact: true },
  { href: '/dashboard/productos',          label: 'Productos',     icon: BoxesIcon },
  { href: '/caja',                         label: 'Caja',          icon: ShoppingCart },
  { href: '/empleados/ingreso-mercaderia', label: 'Ingreso stock', icon: PackagePlus },
  { href: '/empleados/venta-externa',      label: 'Venta externa', icon: Smartphone },
  { href: '/dashboard/configuracion',      label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname  = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) setCollapsed(saved === 'true');
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  return (
    <aside
      className={cn(
        'relative flex h-full shrink-0 flex-col border-r border-dash-border bg-white',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* ── Logo ─────────────────────────────────────────────── */}
      <div className={cn(
        'flex h-14 shrink-0 items-center border-b border-dash-border',
        collapsed ? 'justify-center px-1' : 'px-4'
      )}>
        {collapsed ? (
          /* Ícono chico: solo la "n" */
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
            <Image
              src="/logos/negozio-icon-principal.png"
              alt="Negozio"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>
        ) : (
          /* Logo texto completo (letras gruesas) */
          <Image
            src="/logos/negozio-textogrueso-largo.png"
            alt="Negozio"
            width={148}
            height={36}
            className="object-contain object-left"
            priority
          />
        )}
      </div>

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium',
                'transition-colors',
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              {/* Barra activa lateral cuando está colapsado */}
              {active && collapsed && (
                <span className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2
                                  rounded-r-full bg-primary-700" />
              )}

              <item.icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0',
                  active ? 'text-primary-700' : 'text-slate-400'
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Botón colapsar ───────────────────────────────────── */}
      <div className="border-t border-dash-border p-2">
        <button
          onClick={toggleCollapse}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-2.5 py-2
                     text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Colapsar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
