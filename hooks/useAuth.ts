'use client';

import { useCallback } from 'react';

import { useRouter } from 'next/navigation';

import { signInAction, signOutAction } from '@/lib/supabase/actions';
import { checkPermission } from '@/lib/supabase/permissions';
import { useAuthStore } from '@/store/auth.store';
import type { Permission } from '@/types/database';

export function useAuth() {
  const router = useRouter();
  const store = useAuthStore();

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await signInAction(email, password);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Hard redirect: recarga completa para que el cliente Supabase
      // detecte las cookies de sesión y AuthProvider se inicialice correctamente
      window.location.href = result.redirectTo;
    },
    []
  );

  const signOut = useCallback(async () => {
    store.reset();
    await signOutAction();
    router.push('/login');
    router.refresh();
  }, [router, store]);

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!store.user) return false;
      return checkPermission(store.user.role, permission, store.permissions);
    },
    [store.user, store.permissions]
  );

  return {
    user: store.user,
    role: store.user?.role ?? null,
    establishment: store.establishment,
    loading: store.isLoading,
    permissions: store.resolvedPermissions,
    signIn,
    signOut,
    can,
  };
}
