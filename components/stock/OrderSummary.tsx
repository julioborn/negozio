'use client';

import { CheckCircle2, ChevronRight, Package } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';
import type { OrderItem } from '@/hooks/useSupplierOrder';
import type { ConfirmedOrderSummary, Supplier } from '@/types/database';

interface Props {
  isOpen: boolean;
  summary: (ConfirmedOrderSummary & { supplier: Supplier | null }) | null;
  items: OrderItem[];          // items originales para mostrar nombres
  onNewSession: () => void;
}

export function OrderSummary({ isOpen, summary, items, onNewSession }: Props) {
  if (!summary) return null;

  const orderId = summary.order_id.slice(0, 8).toUpperCase();

  return (
    <Modal isOpen={isOpen} onClose={onNewSession} size="lg" persistent>
      <div className="flex flex-col items-center gap-6">
        {/* Ícono de éxito */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">¡Ingreso confirmado!</h2>
          <p className="text-sm text-slate-500">
            Orden <code className="rounded bg-slate-100 px-1.5 font-mono text-xs">#{orderId}</code>
            {summary.supplier && (
              <> · <span className="font-medium">{summary.supplier.name}</span></>
            )}
          </p>
        </div>

        {/* Tabla de movimientos */}
        <div className="w-full overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Producto
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ingresado
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock anterior
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock nuevo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.movements.map((mov) => {
                const orderItem = items.find((i) => i.product.id === mov.ep_id);
                return (
                  <tr key={mov.ep_id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 shrink-0 text-slate-300" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {orderItem?.product.name ?? '—'}
                          </p>
                          {orderItem?.product.brand && (
                            <p className="text-xs text-slate-400">{orderItem.product.brand}</p>
                          )}
                          {orderItem?.unitCost != null && (
                            <p className="text-xs text-slate-400">
                              Costo: {formatCurrency(orderItem.unitCost)} c/u
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-green-700">+{mov.quantity}</span>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-sm text-slate-500">
                      {mov.previous_stock}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 font-semibold text-slate-900">
                        <ChevronRight className="h-3.5 w-3.5 text-green-500" />
                        {mov.new_stock}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="flex w-full items-center justify-between rounded-xl bg-green-50 px-4 py-3">
          <span className="text-sm font-medium text-green-800">
            Total de unidades ingresadas
          </span>
          <span className="text-lg font-bold text-green-900">
            {items.reduce((a, i) => a + i.quantity, 0)}
          </span>
        </div>

        {/* Acciones */}
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onNewSession}
            className="
              flex items-center justify-center gap-2 rounded-lg
              bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white
              hover:bg-blue-700
            "
          >
            Nueva sesión de ingreso
          </button>
        </div>
      </div>
    </Modal>
  );
}
