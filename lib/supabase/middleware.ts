import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import type { UserRole } from '@/types/database';

import { ROLE_HOME } from './constants';

// Roles autorizados por prefijo de ruta
const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/dashboard': ['owner'],
  '/caja': ['owner', 'cashier'],
  '/empleados': ['owner', 'employee'],
};

function getRequiredRoles(pathname: string): UserRole[] | null {
  for (const [prefix, roles] of Object.entries(ROUTE_ROLES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return roles;
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Siempre refrescar la sesión primero (requerido por @supabase/ssr)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === '/login';
  const requiredRoles = getRequiredRoles(pathname);

  // ── Usuario no autenticado ────────────────────────────────
  if (!user) {
    if (requiredRoles) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // ── Usuario autenticado: obtener rol y travel_mode ──────
  let role        = request.cookies.get('user-role')?.value as UserRole | undefined;
  let travelMode  = request.cookies.get('user-travel-mode')?.value === 'true';

  if (!role) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, travel_mode')
      .eq('id', user.id)
      .single();

    role       = profile?.role as UserRole | undefined;
    travelMode = profile?.travel_mode ?? false;

    if (role) {
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      };
      response.cookies.set('user-role', role, cookieOpts);
      response.cookies.set('user-travel-mode', String(travelMode), cookieOpts);
    }
  }

  // ── Redirigir /login si ya está logueado ─────────────────
  if (isLoginRoute) {
    const home = travelMode && role === 'employee'
      ? '/empleados/reparto'
      : role ? ROLE_HOME[role] : '/dashboard';
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  // ── Modo viaje: solo puede acceder a /empleados/reparto ──
  if (travelMode && role === 'employee') {
    const allowed = pathname === '/empleados/reparto' || pathname.startsWith('/empleados/reparto/');
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = '/empleados/reparto';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // ── Verificar autorización de rol ────────────────────────
  if (requiredRoles && role && !requiredRoles.includes(role)) {
    const url = request.nextUrl.clone();
    url.pathname = '/403';
    return NextResponse.redirect(url);
  }

  return response;
}
