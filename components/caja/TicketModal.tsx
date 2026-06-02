'use client';

import { CheckCircle2, RefreshCw } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';
import { itemSubtotal } from '@/store/caja.store';
import type { SaleTicket } from '@/hooks/useCaja';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mercadopago: 'Mercado Pago',
  other: 'Otro',
};

interface Props {
  ticket: SaleTicket | null;
  onClose: () => void;
}

export function TicketModal({ ticket, onClose }: Props) {
  if (!ticket) return null;

  return (
    <Modal isOpen={!!ticket} onClose={onClose} size="md" persistent>
      <div className="flex flex-col gap-5">

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Venta cobrada</h2>
          <p className="font-mono text-sm text-slate-500">#{ticket.saleNumber}</p>
        </div>

        {/* Items */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="space-y-1.5">
            {ticket.items.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-slate-700">
                  <span className="font-medium">{item.quantity}×</span> {item.name}
                </span>
                <span className="shrink-0 tabular-nums text-slate-600">
                  {formatCurrency(itemSubtotal(item))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totales */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(ticket.subtotal)}</span>
          </div>
          {ticket.discountPct > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Descuento ({ticket.discountPct}%)</span>
              <span className="tabular-nums">
                -{formatCurrency(ticket.subtotal - ticket.total)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-slate-900">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatCurrency(ticket.total)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>Pagó con {PAYMENT_LABELS[ticket.paymentMethod]}</span>
            {ticket.amountPaid && (
              <span className="tabular-nums">{formatCurrency(ticket.amountPaid)}</span>
            )}
          </div>
          {ticket.changeGiven != null && ticket.changeGiven > 0 && (
            <div className="flex justify-between rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
              <span>Vuelto</span>
              <span className="tabular-nums">{formatCurrency(ticket.changeGiven)}</span>
            </div>
          )}
        </div>

        {/* Botón nueva venta */}
        <button
          onClick={onClose}
          autoFocus
          className="flex w-full items-center justify-center gap-2 rounded-xl
                     bg-blue-600 py-3 text-base font-bold text-white
                     hover:bg-blue-700 focus:outline-none focus:ring-2
                     focus:ring-blue-500 focus:ring-offset-2"
        >
          <RefreshCw className="h-5 w-5" />
          Nueva venta
        </button>
      </div>
    </Modal>
  );
}
