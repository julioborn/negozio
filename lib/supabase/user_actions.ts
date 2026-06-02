'use server';

import type { UserRole } from '@/types/database';

import { createAdminClient } from './admin';
import { createClient } from './server';

export type CreateUserResult =
  | { success: true; userId: string }
  | { success: false; error: string };

export async function createUserAction(data: {
  email: string;
  password: string;
  full_name: string;
  role: 'cashier' | 'employee';
  establishment_id: string;
}): Promise<CreateUserResult> {
  // 1. Verificar que el caller es owner del establecimiento
  const supabase = createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) return { success: false, error: 'No autenticado.' };

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, establishment_id')
    .eq('id', caller.id)
    .single();

  if (
    !callerProfile ||
    callerProfile.role !== 'owner' ||
    callerProfile.establishment_id !== data.establishment_id
  ) {
    return { success: false, error: 'Sin permisos para crear usuarios.' };
  }

  // 2. Crear usuario en Supabase Auth con admin client
  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return { success: false, error: translateError(authError?.message ?? '') };
  }

  // 3. Insertar perfil
  const { error: profileError } = await admin.from('profiles').insert({
    id: authData.user.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role as UserRole,
    establishment_id: data.establishment_id,
    is_active: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: profileError.message };
  }

  return { success: true, userId: authData.user.id };
}

function translateError(msg: string): string {
  if (msg.includes('already been registered') || msg.includes('already exists')) {
    return 'Ya existe una cuenta con ese email.';
  }
  return 'Error al crear el usuario. Intentá de nuevo.';
}
