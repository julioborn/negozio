'use client';

import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  BoxesIcon, DollarSign, Home, LogOut, Menu,
  PackagePlus, Receipt, Settings, ShoppingCart,
  Smartphone, Truck, Users, X,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueno', cashier: 'Cajero', employee: 'Empleado',
};
const ROLE_COLORS: Record<string, string> = {
  owner:    'bg-primary-100 text-primary-700',
  cashier:  'bg-accent-100  text-accent-700',
  employee: 'bg-slate-100   text-slate-700',
};

interface NavLink {
  href: string; label: string; icon: React.ElementType;
  roles: string[]; exact?: boolean;
}
interface NavGroup { title?: string; links: NavLink[] }

const NAV_GROUPS: NavGroup[] = [
  {
    links: [
      { href: '/dashboard',                    label: 'Inicio',        icon: Home,        roles: ['owner'], exact: true },
      { href: '/dashboard/productos',          label: 'Productos',     icon: BoxesIcon,   roles: ['owner'] },
      { href: '/caja',                         label: 'Caja',          icon: ShoppingCart,roles: ['owner', 'cashier'] },
      { href: '/empleados/ingreso-mercaderia', label: 'Stock', icon: PackagePlus, roles: ['owner'] },
    ],
  },
  {
    title: 'Repartos',
    links: [
      { href: '/empleados/venta-externa', label: 'Venta externa', icon: Smartphone,  roles: ['owner'] },
      { href: '/dashboard/viajes',        label: 'Viajes',        icon: Truck,        roles: ['owner'] },
      { href: '/dashboard/repartos',      label: 'Repartos',      icon: DollarSign,   roles: ['owner'] },
      { href: '/empleados/reparto',       label: 'Reparto',       icon: DollarSign,   roles: ['employee'] },
      { href: '/dashboard/clientes',      label: 'Clientes',      icon: Users,        roles: ['owner'] },
      { href: '/dashboard/cobros',        label: 'Cobros',        icon: Receipt,      roles: ['owner'] },
    ],
  },
  {
    links: [
      { href: '/dashboard/configuracion', label: 'Configuracion', icon: Settings, roles: ['owner'] },
    ],
  },
];

interface Props {
  className?:     string;
  rightExtra?:    React.ReactNode;
  showHamburger?: boolean;
}

export function TopBar({ className, rightExtra, showHamburger = true }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const establishment = useAuthStore((s) => s.establishment);
  const pathname = usePathname();

  if (!user) return null;

  const role = user.role ?? 'employee';
  const initials = user.full_name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');
  const isActive = (link: NavLink) =>
    link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(link.href + '/');

  return (
    <>
      <header className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-dash-border bg-white px-4',
        className
      )}>
        {/* Hamburguesa a la IZQUIERDA + logo + establecimiento */}
        <div className="flex items-center gap-2.5 min-w-0">
          {showHamburger && (
            <button onClick={() => setMenuOpen(true)}
              className="flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
          )}
          <Image src="/logos/negozio-icon-principal.png" alt="Negozio"
            width={30} height={30} className="shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 leading-none">
              Panel de control
            </p>
            <p className="truncate text-sm font-bold text-slate-900 leading-tight">
              {establishment?.name ?? 'Mi establecimiento'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightExtra}
          <span className={cn('hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex',
            ROLE_COLORS[role] ?? ROLE_COLORS.employee)}>
            {ROLE_LABELS[role] ?? role}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-slate-700 sm:block">{user.full_name}</span>
          </div>
          <button onClick={signOut} title="Salir"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {showHamburger && (
        <>
          <div
            className={cn(
              'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
              menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
            onClick={() => setMenuOpen(false)}
          />
          <div className={cn(
            'fixed left-0 top-0 bottom-0 z-50 w-72 flex flex-col bg-white shadow-2xl',
            'transition-transform duration-300 ease-in-out',
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          )}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <Image src="/logos/negozio-icon-principal.png" alt="Negozio"
                  width={38} height={38} className="object-contain" />
                <div>
                  <p className="text-xs text-slate-400">Panel de control</p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    {establishment?.name ?? 'Mi establecimiento'}
                  </p>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-2">
              {NAV_GROUPS.map((group, gi) => {
                const visible = group.links.filter((l) => l.roles.includes(role));
                if (visible.length === 0) return null;
                return (
                  <div key={gi}>
                    {group.title && (
                      <p className="px-5 pb-1 pt-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                        {group.title}
                      </p>
                    )}
                    {visible.map((link) => (
                      <Link key={link.href} href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-4 px-5 py-3.5 text-base font-medium transition-colors',
                          isActive(link)
                            ? 'border-r-4 border-primary-700 bg-primary-50 text-primary-700'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        )}>
                        <link.icon className={cn('h-5 w-5 shrink-0',
                          isActive(link) ? 'text-primary-600' : 'text-slate-400')} />
                        {link.label}
                      </Link>
                    ))}
                    {gi < NAV_GROUPS.length - 1 && (
                      <div className="mx-5 mt-1 border-t border-slate-100" />
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-slate-100 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
                  <p className="text-xs text-slate-400">{ROLE_LABELS[role] ?? role}</p>
                </div>
              </div>
              <button
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-danger-600 hover:bg-danger-50 transition-colors">
                <LogOut className="h-5 w-5" />
                Cerrar sesion
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}