'use client';

import { Minus, Package, Plus, Trash2 } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { OrderItem } from '@/hooks/useSupplierOrder';

interface Props {
  items: OrderItem[];
  onUpdateQuantity: (epId: string, qty: number) => void;
  onUpdateUnitCost: (epId: string, cost: number | null) => void;
  onRemove: (epId: string) => void;
  disabled?: boolean;
}

export function OrderItemList({
  items,
  onUpdateQuantity,
  onUpdateUnitCost,
  onRemove,
  disabled = false,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
        <Package className="h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">
          Todavía no agregaste productos
        </p>
        <p className="text-xs text-slate-400">
          Escaneá un código de barras para empezar
        </p>
      </div>
    );
  }

  const total = items.reduce((acc, i) => {
    if (i.unitCost != null) return acc + i.unitCost * i.quantity;
    return acc;
  }, 0);
  const hasAnyCost = items.some((i) => i.unitCost != null);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Producto
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stock actual
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cantidad a ingresar
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Costo unit. (opc.)
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <OrderRow
                key={item.product.id}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onUpdateUnitCost={onUpdateUnitCost}
                onRemove={onRemove}
                disabled={disabled}
              />
            ))}
          </tbody>

          {hasAnyCost && (
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                  Total estimado:
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                  {formatCurrency(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-right text-xs text-slate-400">
        {items.length} {items.length === 1 ? 'producto' : 'productos'} ·{' '}
        {items.reduce((a, i) => a + i.quantity, 0)} unidades en total
      </p>
    </div>
  );
}

// ─── Fila individual ─────────────────────────────────────────
interface RowProps {
  item: OrderItem;
  onUpdateQuantity: (epId: string, qty: number) => void;
  onUpdateUnitCost: (epId: string, cost: number | null) => void;
  onRemove: (epId: string) => void;
  disabled: boolean;
}

function OrderRow({ item, onUpdateQuantity, onUpdateUnitCost, onRemove, disabled }: RowProps) {
  const { product, quantity, unitCost } = item;

  return (
    <tr className="group">
      {/* Producto */}
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{product.name}</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{product.barcode}</span>
            {product.brand && (
              <span className="text-xs text-slate-400">· {product.brand}</span>
            )}
          </div>
        </div>
      </td>

      {/* Stock actual */}
      <td className="px-4 py-3 text-center">
        <span className="tabular-nums text-sm text-slate-600">{product.stock}</span>
      </td>

      {/* Cantidad — stepper */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onUpdateQuantity(product.id, quantity - 1)}
            disabled={disabled || quantity <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-slate-600
                       hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>

          <input
            type="number"
            min={1}
            value={quantity}
            disabled={disabled}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) onUpdateQuantity(product.id, v);
            }}
            className="w-16 rounded-lg border border-slate-300 py-1 text-center text-sm
                       font-semibold tabular-nums focus:border-blue-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
          />

          <button
            type="button"
            onClick={() => onUpdateQuantity(product.id, quantity + 1)}
            disabled={disabled}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-slate-600
                       hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>

      {/* Costo unitario opcional */}
      <td className="px-4 py-3">
        <div className="relative flex justify-end">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="—"
            value={unitCost ?? ''}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value === '' ? null : parseFloat(e.target.value);
              onUpdateUnitCost(product.id, v);
            }}
            className="w-28 rounded-lg border border-slate-200 py-1.5 pl-6 pr-2 text-right
                       text-sm focus:border-blue-500 focus:outline-none focus:ring-1
                       focus:ring-blue-500 disabled:bg-slate-50"
          />
        </div>
      </td>

      {/* Eliminar */}
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onRemove(product.id)}
          disabled={disabled}
          className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-opacity
                     hover:bg-red-50 hover:text-red-500 group-hover:opacity-100
                     disabled:cursor-not-allowed"
          title="Quitar producto"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
