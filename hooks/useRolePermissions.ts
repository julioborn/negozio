'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { checkPermission } from '@/lib/supabase/permissions';
import type { Permission, RolePermission, UserRole } from '@/types/database';

// Los 4 permisos configurables desde el panel
export const CONFIGURABLE_PERMISSIONS: Array<{
  id: Permission;
  label: string;
  description: string;
}> = [
  {
    id: 'stock.create',
    label: 'Puede ingresar mercadería',
    description: 'Acceso a /empleados/ingreso-mercaderia',
  },
  {
    id: 'stock.edit',
    label: 'Puede registrar salidas de stock',
    description: 'Ajustes manuales de stock',
  },
  {
    id: 'products.create',
    label: 'Puede agregar productos nuevos',
    description: 'Crear productos en el catálogo',
  },
  {
    id: 'products.edit',
    label: 'Puede editar precios',
    description: 'Modificar precio de venta',
  },
];

const CONFIGURABLE_ROLES: UserRole[] = ['employee', 'cashier'];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useRolePermissions() {
  const supabase = useMemo(() => createClient(), []);
  const [overrides, setOverrides] = useState<RolePermission[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});

  useEffect(() => {
    supabase
      .from('role_permissions')
      .select('*')
      .in('role', CONFIGURABLE_ROLES)
      .in('permission', CONFIGURABLE_PERMISSIONS.map((p) => p.id))
      .then(({ data }) => {
        setOverrides((data as RolePermission[]) ?? []);
        setLoading(false);
      });
  }, [supabase]);

  // Devuelve el valor efectivo (override DB > default)
  const getPermission = useCallback(
    (role: UserRole, permission: Permission): boolean => {
      return checkPermission(role, permission, overrides);
    },
    [overrides]
  );

  // Guarda inmediatamente en DB con feedback visual
  const togglePermission = useCallback(
    async (role: UserRole, permission: Permission, value: boolean) => {
      const key = `${role}:${permission}`;
      setSaveStatus((prev) => ({ ...prev, [key]: 'saving' }));

      // Update optimista
      setOverrides((prev) => {
        const existing = prev.findIndex(
          (p) => p.role === role && p.permission === permission
        );
        if (existing >= 0) {
          return prev.map((p, i) => (i === existing ? { ...p, is_allowed: value } : p));
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role,
            permission,
            is_allowed: value,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as RolePermission,
        ];
      });

      const { error } = await supabase.from('role_permissions').upsert(
        { role, permission, is_allowed: value },
        { onConflict: 'role,permission' }
      );

      const status = error ? 'error' : 'saved';
      setSaveStatus((prev) => ({ ...prev, [key]: status }));

      // Volver a 'idle' después de 2s
      setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [key]: 'idle' }));
      }, 2000);

      if (error) {
        // Revertir si falló
        setOverrides((prev) =>
          prev.map((p) =>
            p.role === role && p.permission === permission
              ? { ...p, is_allowed: !value }
              : p
          )
        );
      }
    },
    [supabase]
  );

  return {
    overrides,
    isLoading,
    saveStatus,
    getPermission,
    togglePermission,
    configurableRoles: CONFIGURABLE_ROLES,
  };
}
