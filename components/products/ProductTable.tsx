'use client';

import Image from 'next/image';

import { AlertTriangle, ChevronLeft, ChevronRight, Package, Trash2 } from 'lucide-react';

import { InlinePriceEdit } from './InlinePriceEdit';
import { cn } from '@/lib/utils';
import type { EstablishmentProductDetail } from '@/types/database';

const UNIT_LABELS: Record<string, string> = {
  unit: 'Unidad',
  kg: 'Kg',
  liter: 'Litro',
  pack: 'Pack',
  gram: 'Gramo',
};

interface Props {
  items: EstablishmentProductDetail[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  canEditPrice: boolean;
  onPageChange: (p: number) => void;
  onPriceSave: (epId: string, price: number) => Promise<void>;
  onDelete: (epId: string) => Promise<void>;
}

export function ProductTable({
  items,
  total,
  page,
  pageSize,
  isLoading,
  canEditPrice,
  onPageChange,
  onPriceSave,
  onDelete,
}: Props) {
  const totalPages = Math.ceil(total / pageSize);
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex flex-col gap-3">
      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Producto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Código
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Categoría
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Unidad
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Precio
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stock
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-400">
                  No se encontraron productos
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <ProductRow
                  key={item.id}
                  item={item}
                  canEditPrice={canEditPrice}
                  onPriceSave={onPriceSave}
                  onDelete={onDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {total > pageSize && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            {from}–{to} de {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="rounded-lg p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fila individual ─────────────────────────────────────────
interface RowProps {
  item: EstablishmentProductDetail;
  canEditPrice: boolean;
  onPriceSave: (epId: string, price: number) => Promise<void>;
  onDelete: (epId: string) => Promise<void>;
}

function ProductRow({ item, canEditPrice, onPriceSave, onDelete }: RowProps) {
  return (
    <tr className="group transition-colors hover:bg-slate-50">
      {/* Imagen + nombre + marca */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                className="object-cover"
                sizes="40px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-5 w-5 text-slate-300" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
            {item.brand && (
              <p className="truncate text-xs text-slate-400">{item.brand}</p>
            )}
          </div>
        </div>
      </td>

      {/* Código */}
      <td className="px-4 py-3">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
          {item.barcode}
        </span>
      </td>

      {/* Categoría */}
      <td className="px-4 py-3">
        {item.category_name ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${item.category_color ?? '#6366f1'}20`,
              color: item.category_color ?? '#6366f1',
            }}
          >
            {item.category_name}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>

      {/* Unidad */}
      <td className="px-4 py-3 text-sm text-slate-600">
        {UNIT_LABELS[item.unit_type] ?? item.unit_type}
      </td>

      {/* Precio (editable inline) */}
      <td className="px-4 py-3 text-right">
        <InlinePriceEdit
          epId={item.id}
          currentPrice={item.price}
          canEdit={canEditPrice}
          onSave={onPriceSave}
        />
      </td>

      {/* Stock con alerta */}
      <td className="px-4 py-3 text-right">
        <span
          className={cn(
            'flex items-center justify-end gap-1 text-sm font-medium tabular-nums',
            item.is_low_stock ? 'text-red-600' : 'text-slate-900'
          )}
        >
          {item.is_low_stock && <AlertTriangle className="h-3.5 w-3.5" />}
          {item.stock}
        </span>
        <span className="text-xs text-slate-400">
          mín {item.stock_min_alert}
        </span>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3">
        <button
          onClick={() => {
            if (confirm(`¿Eliminar "${item.name}" del establecimiento?`)) {
              onDelete(item.id);
            }
          }}
          title="Eliminar producto"
          className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
