'use client';

import { AlertTriangle, Minus, Package, Plus, Trash2 } from 'lucide-react';

import { cn, formatCurrency } from '@/lib/utils';
import type { ExternalSaleCartItem } from '@/store/externalSale.store';

interface Props {
  items: ExternalSaleCartItem[];
  onUpdateQuantity: (epId: string, qty: number) => void;
  onRemove: (epId: string) => void;
}

export function ExternalItemList({ items, onUpdateQuantity, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed
                      border-slate-200 py-10 text-center">
        <Package className="h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">Todavía no hay productos</p>
        <p className="text-xs text-slate-400">Escaneá o buscá para agregar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <ExternalItemCard
          key={item.epId}
          item={item}
          onUpdateQuantity={onUpdateQuantity}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

interface CardProps {
  item: ExternalSaleCartItem;
  onUpdateQuantity: (epId: string, qty: number) => void;
  onRemove: (epId: string) => void;
}

function ExternalItemCard({ item, onUpdateQuantity, onRemove }: CardProps) {
  const overStock = item.quantity > item.availableStock;
  const subtotal = item.unitPrice * item.quantity;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4 transition-colors',
        overStock ? 'border-red-200 bg-red-50' : 'border-slate-200'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Info del producto */}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-tight text-slate-900 truncate">
            {item.name}
          </p>
          {item.brand && <p className="text-sm text-slate-400">{item.brand}</p>}
          <p className="mt-1 text-sm text-slate-500">
            {formatCurrency(item.unitPrice)} c/u
          </p>

          {/* Alerta de stock */}
          {overStock && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              Solo hay {item.availableStock} en stock
            </p>
          )}
        </div>

        {/* Botón eliminar */}
        <button
          onClick={() => onRemove(item.epId)}
          className="rounded-xl p-2 text-slate-300 active:bg-red-50 active:text-red-500"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Fila inferior: stepper + subtotal */}
      <div className="mt-3 flex items-center justify-between">
        {/* Stepper de cantidad — botones grandes para mobile */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onUpdateQuantity(item.epId, item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="flex h-10 w-10 items-center justify-center rounded-xl
                       border-2 border-slate-200 bg-white text-slate-700
                       active:bg-slate-100 disabled:opacity-30"
          >
            <Minus className="h-4 w-4" />
          </button>

          <span className="min-w-[2rem] text-center text-xl font-bold text-slate-900 tabular-nums">
            {item.quantity}
          </span>

          <button
            onClick={() => onUpdateQuantity(item.epId, item.quantity + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl
                       bg-blue-600 text-white active:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Subtotal */}
        <span className={cn(
          'text-lg font-bold tabular-nums',
          overStock ? 'text-red-600' : 'text-slate-900'
        )}>
          {formatCurrency(subtotal)}
        </span>
      </div>
    </div>
  );
}
