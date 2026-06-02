'use client';

import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  BarChart3,
  BoxesIcon,
  LogOut,
  Menu,
  PackagePlus,
  Settings,
  ShoppingCart,
  Smartphone,
  X,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavLink {
  href:   string;
  label:  string;
  icon:   React.ElementType;
  roles:  string[];
  exact?: boolean;
}

const ALL_LINKS: NavLink[] = [
  { href: '/dashboard',                    label: 'Dashboard',     icon: BarChart3,   roles: ['owner'],             exact: true },
  { href: '/dashboard/productos',          label: 'Productos',     icon: BoxesIcon,   roles: ['owner'] },
  { href: '/caja',                         label: 'Caja',          icon: ShoppingCart,roles: ['owner', 'cashier'] },
  { href: '/empleados/ingreso-mercaderia', label: 'Ingreso stock', icon: PackagePlus, roles: ['owner', 'employee'] },
  { href: '/empleados/venta-externa',      label: 'Venta externa', icon: Smartphone,  roles: ['owner'] },
  { href: '/dashboard/configuracion',      label: 'Configuración', icon: Settings,    roles: ['owner'] },
];

interface Props {
  title?:       string;
  rightExtra?:  React.ReactNode;
  className?:   string;
  /** dark = estilo para la caja */
  dark?:        boolean;
}

export function AppHeader({ title, rightExtra, className, dark = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  const role = user?.role ?? 'employee';
  const visibleLinks = ALL_LINKS.filter((l) => l.roles.includes(role));

  function isActive(link: NavLink) {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(link.href + '/');
  }

  const hdr = dark
    ? 'border-caja-border bg-caja-surface text-white'
    : 'border-dash-border bg-white text-slate-900';
  const iconCls     = dark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900';
  const menuBg      = dark ? 'bg-caja-surface border-caja-border' : 'bg-white border-dash-border';
  const menuText    = dark ? 'text-gray-200' : 'text-slate-700';
  const menuHover   = dark ? 'hover:bg-gray-800' : 'hover:bg-slate-50';
  const menuActive  = dark ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-50 text-primary-700';
  const menuDivider = dark ? 'border-gray-700' : 'border-slate-200';

  return (
    <>
      <header className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b px-4',
        hdr, className
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image
            src="/logos/negozio-icon-principal.png"
            alt="Negozio"
            width={32}
            height={32}
            className="object-contain"
          />
          {title && (
            <span className={cn('text-sm font-semibold', dark ? 'text-gray-300' : 'text-slate-600')}>
              {title}
            </span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {rightExtra}

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={cn('rounded-lg p-2 transition-colors', iconCls)}
            aria-label="Menú"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer desde arriba */}
      <div className={cn(
        'fixed left-0 right-0 top-14 z-50 border-b shadow-xl transition-transform duration-200',
        menuBg,
        menuOpen ? 'translate-y-0' : '-translate-y-full pointer-events-none'
      )}>
        {/* Usuario */}
        <div className={cn('flex items-center gap-3 border-b px-4 py-3', menuDivider)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white">
            {user?.full_name?.split(' ').slice(0, 2).map((n) => n[0]).join('') ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('truncate text-sm font-semibold', menuText)}>{user?.full_name}</p>
            <p className={cn('text-xs capitalize', dark ? 'text-gray-500' : 'text-slate-400')}>
              {role === 'owner' ? 'Dueño' : role === 'cashier' ? 'Cajero' : 'Empleado'}
            </p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="py-2">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
                menuHover,
                isActive(link) ? menuActive : menuText
              )}
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className={cn('border-t p-3', menuDivider)}>
          <button
            onClick={() => { setMenuOpen(false); signOut(); }}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
              'text-danger-500 transition-colors',
              dark ? 'hover:bg-red-950/50' : 'hover:bg-danger-50'
            )}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );
}
