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

  // ── Usuario autenticado: obtener rol ──────────────────────
  let role = request.cookies.get('user-role')?.value as UserRole | undefined;

  // Si no hay cookie (sesión ya activa sin cookie, p.ej. otro dispositivo), consultamos la DB
  if (!role) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    role = profile?.role as UserRole | undefined;

    if (role) {
      response.cookies.set('user-role', role, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }
  }

  // ── Redirigir /login si ya está logueado ─────────────────
  if (isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = role ? ROLE_HOME[role] : '/dashboard';
    return NextResponse.redirect(url);
  }

  // ── Verificar autorización de rol ────────────────────────
  if (requiredRoles && role && !requiredRoles.includes(role)) {
    const url = request.nextUrl.clone();
    url.pathname = '/403';
    return NextResponse.redirect(url);
  }

  return response;
}
