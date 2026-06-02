/** Traduce mensajes de error de Supabase/Postgres al español. */
export function translateSupabaseError(message: string | undefined | null): string {
  if (!message) return 'Ocurrió un error inesperado. Intentá de nuevo.';
  const m = message.toLowerCase();

  if (m.includes('jwt expired') || m.includes('session_not_found') || m.includes('refresh_token_not_found')) {
    return 'Tu sesión expiró. Iniciá sesión nuevamente.';
  }
  if (m.includes('invalid jwt') || m.includes('invalid api key')) {
    return 'Sesión inválida. Iniciá sesión nuevamente.';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('econnrefused') || m.includes('enotfound')) {
    return 'Error de conexión. Verificá tu internet e intentá de nuevo.';
  }
  if (m.includes('permission denied') || m.includes('row-level security') || m.includes('insufficient_privilege')) {
    return 'No tenés permiso para realizar esta acción.';
  }
  if (m.includes('duplicate key') || m.includes('unique violation') || m.includes('already exists')) {
    return 'Ya existe un registro con esos datos.';
  }
  if (m.includes('not null violation') || m.includes('null value')) {
    return 'Hay campos requeridos sin completar.';
  }
  if (m.includes('foreign key violation')) {
    return 'No se puede completar la operación porque referencia datos que no existen.';
  }
  if (m.includes('check violation')) {
    return 'Los datos ingresados no son válidos.';
  }
  if (m.includes('too many requests')) {
    return 'Demasiadas solicitudes. Esperá unos segundos e intentá de nuevo.';
  }
  if (m.includes('invalid login credentials') || m.includes('email not confirmed')) {
    return 'Email o contraseña incorrectos.';
  }
  if (m.includes('user already registered')) {
    return 'Ya existe una cuenta con ese email.';
  }
  return 'Ocurrió un error inesperado. Si el problema persiste, contactá al administrador.';
}

/** Extrae el mensaje de un error desconocido. */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return translateSupabaseError(error.message);
  if (typeof error === 'string') return translateSupabaseError(error);
  return 'Error desconocido.';
}
