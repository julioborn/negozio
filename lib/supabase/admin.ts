// ⚠️  SERVIDOR ÚNICAMENTE — no importar en componentes cliente
// Solo usar en archivos con 'use server' (Server Actions)

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no está configurada. ' +
        'Agregala en .env.local (Supabase → Project Settings → API → service_role).'
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
