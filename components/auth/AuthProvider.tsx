'use client';

import { useEffect } from 'react';

import { AppLoader } from '@/components/ui/AppLoader';
import { createClient } from '@/lib/supabase/client';
import {
  fetchRolePermissions,
  resolvePermissions,
} from '@/lib/supabase/permissions';
import { useAuthStore } from '@/store/auth.store';
import type { Establishment, Profile, UserRole } from '@/types/database';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setEstablishment, setPermissions, setLoading } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(userId: string) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profile) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(profile as Profile);

      // Cargar el establecimiento vinculado al perfil
      if ((profile as Profile).establishment_id) {
        const { data: est } = await supabase
          .from('establishments')
          .select('*')
          .eq('id', (profile as Profile).establishment_id!)
          .single();
        if (est) setEstablishment(est as Establishment);
      }

      const dbPermissions = await fetchRolePermissions(supabase, profile.role as UserRole);
      const resolved = resolvePermissions(profile.role as UserRole, dbPermissions);
      setPermissions(dbPermissions, resolved);
      setLoading(false);
    }

    // Cargar sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Escuchar cambios de sesión (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setEstablishment(null);
        setPermissions([], []);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setPermissions, setLoading]);

  return <AuthLoadingGate>{children}</AuthLoadingGate>;
}

// Bloquea toda la UI hasta que la sesión está resuelta — evita flashes de "Sin acceso"
function AuthLoadingGate({ children }: { children: React.ReactNode }) {
  const isLoading = useAuthStore((s) => s.isLoading);
  if (isLoading) return <AppLoader />;
  return <>{children}</>;
}
