'use server';

import { cookies } from 'next/headers';

import type { UserRole } from '@/types/database';

import { ROLE_HOME } from './constants';
import { createAdminClient } from './admin';
import { createClient } from './server';

export type SignInResult =
  | { success: true; role: UserRole; redirectTo: string }
  | { success: false; error: string };

export async function signInAction(email: string, password: string): Promise<SignInResult> {
  const supabase = createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { success: false, error: translateAuthError(authError?.message ?? '') };
  }

  // Usamos admin client para el lookup de perfil porque la sesión
  // todavía no está en las cookies al momento de esta consulta (Server Action)
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, is_active, travel_mode')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { success: false, error: 'No se encontró el perfil del usuario.' };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: 'Tu cuenta está desactivada. Contactá al administrador.',
    };
  }

  const role       = profile.role as UserRole;
  const travelMode = (profile as { travel_mode?: boolean }).travel_mode ?? false;

  const cookieStore = cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  };

  cookieStore.set('user-travel-mode', String(travelMode), cookieOpts);
  cookieStore.set('user-role', role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  const redirectTo = travelMode && role === 'employee'
    ? '/empleados/reparto'
    : ROLE_HOME[role];

  return { success: true, role, redirectTo };
}

export async function signOutAction(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  cookies().delete('user-role');
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (message.includes('Email not confirmed'))
    return 'Confirmá tu email antes de iniciar sesión.';
  if (message.includes('Too many requests'))
    return 'Demasiados intentos fallidos. Esperá unos minutos.';
  if (message.includes('User not found')) return 'No existe una cuenta con ese email.';
  return 'Error al iniciar sesión. Intentá de nuevo.';
}
