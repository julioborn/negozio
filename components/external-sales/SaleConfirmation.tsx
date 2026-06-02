'use client';

import { CheckCircle2, Package, RefreshCw, TrendingDown } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { ConfirmedExternalSaleSummary } from '@/types/database';
import type { ExternalSaleCartItem } from '@/store/externalSale.store';

interface Props {
  summary: ConfirmedExternalSaleSummary;
  items: ExternalSaleCartItem[];
  registerPayment: boolean;
  total: number;
  paymentMethod: 'cash' | 'transfer' | null;
  customerName: string;
  onNewSale: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

export function SaleConfirmation({
  summary, items, registerPayment, total, paymentMethod, customerName, onNewSale,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-9 w-9 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">¡Venta confirmada!</h2>
          {customerName && (
            <p className="mt-1 text-sm text-slate-500">Para: <strong>{customerName}</strong></p>
          )}
        </div>
      </div>

      {/* Resumen de productos */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Productos vendidos</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {summary.movements.map((mov) => {
            const item = items.find((i) => i.epId === mov.ep_id);
            return (
              <div key={mov.ep_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center
                                rounded-lg bg-slate-100">
                  <Package className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {item?.name ?? mov.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <TrendingDown className="h-3 w-3 text-red-400" />
                    <span>{mov.previous_stock} → {mov.new_stock} en stock</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  ×{mov.quantity}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cobro */}
      {registerPayment ? (
        <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-4 space-y-2">
          <div className="flex justify-between text-base font-bold text-green-900">
            <span>Total cobrado</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
          {paymentMethod && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Método</span>
              <span>{PAYMENT_LABELS[paymentMethod]}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
          <p className="text-center text-sm text-slate-500">Solo se registró la salida de stock</p>
        </div>
      )}

      {/* Botón nueva venta */}
      <button
        onClick={onNewSale}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl
                   bg-blue-600 text-lg font-bold text-white active:scale-[0.97] active:bg-blue-500"
      >
        <RefreshCw className="h-6 w-6" />
        Nueva venta
      </button>
    </div>
  );
}
