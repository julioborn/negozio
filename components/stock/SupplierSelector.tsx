'use client';

import { ChevronDown, Truck } from 'lucide-react';

import type { Supplier } from '@/types/database';

interface Props {
  suppliers: Supplier[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function SupplierSelector({
  suppliers,
  value,
  onChange,
  disabled = false,
  isLoading = false,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <Truck className="h-4 w-4 text-slate-400" />
        Proveedor
      </label>

      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled || isLoading}
          className="
            w-full appearance-none rounded-lg border border-slate-300 bg-white
            py-2.5 pl-3 pr-10 text-sm text-slate-900
            focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400
          "
        >
          <option value="">Sin proveedor registrado</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.contact_name ? ` — ${s.contact_name}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {!isLoading && suppliers.length === 0 && (
        <p className="text-xs text-slate-400">
          No hay proveedores registrados. Podés agregar uno desde el dashboard.
        </p>
      )}
    </div>
  );
}
