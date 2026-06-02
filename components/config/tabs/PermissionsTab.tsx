'use client';

import { Check, Loader2, X } from 'lucide-react';

import { Toggle } from '@/components/ui/Toggle';
import {
  CONFIGURABLE_PERMISSIONS,
  useRolePermissions,
} from '@/hooks/useRolePermissions';
import type { UserRole } from '@/types/database';

const ROLE_LABELS: Record<string, string> = {
  employee: 'Empleado',
  cashier:  'Cajero',
};

export function PermissionsTab() {
  const { isLoading, saveStatus, getPermission, togglePermission, configurableRoles } =
    useRolePermissions();

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-slate-400">Cargando permisos…</div>;
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <p className="text-sm text-slate-500">
        Los cambios se guardan automáticamente. El rol <strong>Owner</strong> siempre tiene acceso completo.
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Header con roles */}
        <div className="grid border-b border-slate-100 bg-slate-50"
          style={{ gridTemplateColumns: '1fr repeat(2, 7rem)' }}>
          <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Permiso
          </div>
          {configurableRoles.map((role) => (
            <div key={role} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              {ROLE_LABELS[role] ?? role}
            </div>
          ))}
        </div>

        {/* Filas de permisos */}
        <div className="divide-y divide-slate-100">
          {CONFIGURABLE_PERMISSIONS.map((perm) => (
            <div key={perm.id}
              className="grid items-center"
              style={{ gridTemplateColumns: '1fr repeat(2, 7rem)' }}>
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-slate-900">{perm.label}</p>
                <p className="text-xs text-slate-400">{perm.description}</p>
              </div>

              {configurableRoles.map((role) => {
                const key = `${role}:${perm.id}`;
                const status = saveStatus[key] ?? 'idle';
                const value = getPermission(role as UserRole, perm.id);

                return (
                  <div key={role} className="flex flex-col items-center gap-1 px-4 py-4">
                    <Toggle
                      checked={value}
                      onChange={(v) => togglePermission(role as UserRole, perm.id, v)}
                      disabled={status === 'saving'}
                    />
                    {/* Feedback visual */}
                    <span className="h-4">
                      {status === 'saving' && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                      )}
                      {status === 'saved' && (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      )}
                      {status === 'error' && (
                        <X className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        ✦ Estos permisos aplican por rol para todo el establecimiento.
        Para personalizar por usuario, usá la sección de permisos individuales (próximamente).
      </p>
    </div>
  );
}
