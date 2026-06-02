import type { Permission, RolePermission, UserRole } from '@/types/database';

import type { SupabaseClient } from '@supabase/supabase-js';

// Permisos por defecto de cada rol (fallback si no hay overrides en DB)
const DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'stock.view', 'stock.create', 'stock.edit', 'stock.delete',
    'products.view', 'products.create', 'products.edit', 'products.delete',
    'sales.view', 'sales.create', 'sales.cancel', 'sales.refund',
    'external_sales.view', 'external_sales.create',
    'reports.view', 'reports.export',
    'employees.view', 'employees.manage',
    'cash_register.open', 'cash_register.close',
    'settings.view', 'settings.manage',
  ],
  cashier: [
    'products.view',
    'sales.view', 'sales.create',
    'cash_register.open', 'cash_register.close',
    'stock.view',
  ],
  employee: [
    'products.view', 'products.create',
    'stock.view', 'stock.create', 'stock.edit',
    'sales.view',
  ],
};

/**
 * Consulta la tabla role_permissions y devuelve todos los registros del rol.
 * Retorna array vacío si la tabla no existe todavía.
 */
export async function fetchRolePermissions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  role: UserRole
): Promise<RolePermission[]> {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role', role);

    if (error) return [];
    return (data as RolePermission[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * Verifica si un rol tiene un permiso dado.
 * Prioridad: overrides de DB > defaults del código.
 */
export function checkPermission(
  role: UserRole,
  permission: Permission,
  cachedPermissions?: RolePermission[]
): boolean {
  if (cachedPermissions && cachedPermissions.length > 0) {
    const override = cachedPermissions.find(
      (p) => p.role === role && p.permission === permission
    );
    if (override !== undefined) return override.is_allowed;
  }
  return DEFAULT_PERMISSIONS[role].includes(permission);
}

/**
 * Devuelve el set completo de permisos efectivos para un rol,
 * combinando defaults y overrides de la DB.
 */
export function resolvePermissions(
  role: UserRole,
  dbPermissions: RolePermission[]
): Permission[] {
  const all = new Set<Permission>(DEFAULT_PERMISSIONS[role]);

  for (const row of dbPermissions) {
    if (row.role !== role) continue;
    if (row.is_allowed) all.add(row.permission);
    else all.delete(row.permission);
  }

  return Array.from(all);
}
