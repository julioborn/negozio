'use client';

import { useEffect, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  BarChart3, BoxesIcon, ChevronLeft, ChevronRight,
  DollarSign, PackagePlus, Receipt, Settings,
  ShoppingCart, Smartphone, Truck, Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface NavItem {
  href:   string;
  label:  string;
  icon:   React.ElementType;
  exact?: boolean;
}

interface NavGroup {
  title?: string;
  items:  NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard',                    label: 'Inicio',        icon: BarChart3,   exact: true },
      { href: '/dashboard/productos',          label: 'Productos',     icon: BoxesIcon },
      { href: '/caja',                         label: 'Caja',          icon: ShoppingCart },
      { href: '/empleados/ingreso-mercaderia', label: 'Stock',         icon: PackagePlus },
    ],
  },
  {
    title: 'Repartos',
    items: [
      { href: '/empleados/venta-externa',  label: 'Venta externa', icon: Smartphone },
      { href: '/dashboard/viajes',         label: 'Viajes',        icon: Truck },
      { href: '/dashboard/repartos',       label: 'Repartos',      icon: DollarSign },
      { href: '/dashboard/clientes',       label: 'Clientes',      icon: Users },
      { href: '/dashboard/cobros',         label: 'Cobros',        icon: Receipt },
    ],
  },
  {
    items: [
      { href: '/dashboard/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
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
    <aside className={cn(
      'relative flex h-full shrink-0 flex-col border-r border-dash-border bg-white',
      'transition-[width] duration-200 ease-in-out',
      collapsed ? 'w-14' : 'w-56'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex h-14 shrink-0 items-center border-b border-dash-border',
        collapsed ? 'justify-center px-1' : 'px-4'
      )}>
        {collapsed ? (
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
            <Image src="/logos/negozio-icon-principal.png" alt="Negozio"
              width={32} height={32} className="object-contain" priority />
          </div>
        ) : (
          <Image src="/logos/negozio-textogrueso-largo.png" alt="Negozio"
            width={148} height={36} className="object-contain object-left" priority />
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col overflow-y-auto py-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.title && !collapsed && (
              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {group.title}
              </p>
            )}
            {group.title && collapsed && gi > 0 && (
              <div className="mx-2 my-1 border-t border-slate-100" />
            )}
            <div className="flex flex-col gap-0.5 px-2">
              {group.items.map(item => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    {active && collapsed && (
                      <span className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-r-full bg-primary-700" />
                    )}
                    <item.icon className={cn('h-[18px] w-[18px] shrink-0',
                      active ? 'text-primary-700' : 'text-slate-400')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Botón colapsar */}
      <div className="border-t border-dash-border p-2">
        <button
          onClick={toggleCollapse}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-2.5 py-2
                     text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <><ChevronLeft className="h-4 w-4" /><span className="text-xs font-medium">Colapsar</span></>
          }
        </button>
      </div>
    </aside>
  );
}
