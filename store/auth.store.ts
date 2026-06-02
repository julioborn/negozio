import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { Establishment, Permission, Profile, RolePermission } from '@/types/database';

interface AuthState {
  user: Profile | null;
  establishment: Establishment | null;
  permissions: RolePermission[];
  resolvedPermissions: Permission[];
  isLoading: boolean;

  setUser: (user: Profile | null) => void;
  setEstablishment: (establishment: Establishment | null) => void;
  setPermissions: (permissions: RolePermission[], resolved: Permission[]) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  establishment: null,
  permissions: [],
  resolvedPermissions: [],
  isLoading: true,
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setUser: (user) => set({ user }),
        setEstablishment: (establishment) => set({ establishment }),
        setPermissions: (permissions, resolvedPermissions) =>
          set({ permissions, resolvedPermissions }),
        setLoading: (isLoading) => set({ isLoading }),
        reset: () => set({ ...initialState, isLoading: false }),
      }),
      {
        name: 'negozio-auth',
        // Solo persistir user y establishment para hidratación inicial
        partialize: (state) => ({
          user: state.user,
          establishment: state.establishment,
        }),
      }
    ),
    { name: 'AuthStore' }
  )
);
