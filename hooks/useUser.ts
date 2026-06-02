'use client';

import { useAuth } from './useAuth';

/** @deprecated Usá useAuth() directamente. Este hook se mantiene por compatibilidad. */
export function useUser() {
  const { user, role, loading } = useAuth();
  return {
    user,
    isLoading: loading,
    isOwner: role === 'owner',
    isCashier: role === 'cashier',
    isEmployee: role === 'employee',
  };
}
