'use client';

import { useState } from 'react';

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
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  owner:    'Dueño',
  cashier:  'Cajero',
  employee: 'Empleado',
};

const ROLE_COLORS: Record<string, string> = {
  owner:    'bg-primary-100 text-primary-700',
  cashier:  'bg-accent-100  text-accent-700',
  employee: 'bg-slate-100   text-slate-700',
};

interface NavLink {
  href:  string;
  label: string;
  icon:  React.ElementType;
  roles: string[];
  exact?: boolean;
}

const ALL_LINKS: NavLink[] = [
  { href: '/dashboard',                    label: 'Dashboard',     icon: BarChart3,    roles: ['owner'],             exact: true },
  { href: '/dashboard/productos',          label: 'Productos',     icon: BoxesIcon,    roles: ['owner'] },
  { href: '/caja',                         label: 'Caja',          icon: ShoppingCart, roles: ['owner', 'cashier'] },
  { href: '/empleados/ingreso-mercaderia', label: 'Ingreso stock', icon: PackagePlus,  roles: ['owner', 'employee'] },
  { href: '/empleados/venta-externa',      label: 'Venta externa', icon: Smartphone,   roles: ['owner'] },
  { href: '/dashboard/configuracion',      label: 'Configuración', icon: Settings,     roles: ['owner'] },
];

interface Props {
  className?:   string;
  /** Elementos extra en la derecha (ej: toggle dark/light de la caja) */
  rightExtra?:  React.ReactNode;
  /** Si false, oculta el botón hamburguesa (cuando el Sidebar ya maneja la nav) */
  showHamburger?: boolean;
}

export function TopBar({ className, rightExtra, showHamburger = true }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const establishment = useAuthStore((s) => s.establishment);
  const pathname = usePathname();

  if (!user) return null;

  const role     = user.role ?? 'employee';
  const initials = user.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  const visibleLinks = ALL_LINKS.filter((l) => l.roles.includes(role));

  function isActive(link: NavLink) {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(link.href + '/');
  }

  return (
    <>
      <header
        className={cn(
          'flex h-14 shrink-0 items-center justify-between border-b border-dash-border bg-white px-5',
          className
        )}
      >
        {/* Izquierda: nombre del establecimiento */}
        <p className="text-sm font-semibold text-slate-800">
          {establishment?.name ?? 'Mi Tienda'}
        </p>

        {/* Derecha: usuario + acciones */}
        <div className="flex items-center gap-2">
          {/* Extra (ej: toggle caja) */}
          {rightExtra}

          {/* Badge de rol */}
          <span
            className={cn(
              'hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex',
              ROLE_COLORS[role] ?? ROLE_COLORS.employee
            )}
          >
            {ROLE_LABELS[role] ?? role}
          </span>

          {/* Avatar + nombre */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-slate-700 sm:block">
              {user.full_name}
            </span>
          </div>

          {/* Logout (siempre visible) */}
          <button
            onClick={signOut}
            title="Cerrar sesión"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500
                       transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>

          {/* Hamburguesa (opcional) */}
          {showHamburger && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              title="Navegación"
              className="flex items-center justify-center rounded-lg p-2 text-slate-500
                         transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </header>

      {/* ── Menú desplegable ───────────────────────────────────── */}
      {showHamburger && menuOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer desde el header */}
          <div className="fixed left-0 right-0 top-14 z-50 border-b border-dash-border bg-white shadow-xl">
            {/* Links de navegación */}
            <nav className="py-2">
              {visibleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors',
                    isActive(link)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <link.icon className={cn('h-4 w-4 shrink-0', isActive(link) ? 'text-primary-600' : 'text-slate-400')} />
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Logout en el menú */}
            <div className="border-t border-dash-border p-3">
              <button
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                           text-danger-600 transition-colors hover:bg-danger-50"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
