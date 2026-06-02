'use client';

import { Banknote, SendHorizonal, Tag } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

type ExternalPaymentMethod = 'cash' | 'transfer';

interface Props {
  registerPayment: boolean;
  onToggle: (v: boolean) => void;
  computedTotal: number;
  manualTotal: number | null;
  onManualTotalChange: (n: number | null) => void;
  paymentMethod: ExternalPaymentMethod | null;
  onPaymentMethodChange: (m: ExternalPaymentMethod | null) => void;
  customerName: string;
  onCustomerNameChange: (n: string) => void;
  disabled?: boolean;
}

export function PaymentToggle({
  registerPayment, onToggle,
  computedTotal, manualTotal, onManualTotalChange,
  paymentMethod, onPaymentMethodChange,
  customerName, onCustomerNameChange,
  disabled = false,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => onToggle(!registerPayment)}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-3 p-4"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            registerPayment ? 'bg-green-100' : 'bg-slate-100'
          )}>
            <Tag className={cn('h-5 w-5', registerPayment ? 'text-green-600' : 'text-slate-400')} />
          </div>
          <div className="text-left">
            <p className="text-base font-semibold text-slate-900">Registrar cobro</p>
            <p className="text-xs text-slate-400">
              {registerPayment ? 'Se registra el pago recibido' : 'Solo salida de stock, sin precio'}
            </p>
          </div>
        </div>

        {/* Toggle switch visual */}
        <div className={cn(
          'relative h-7 w-12 rounded-full transition-colors',
          registerPayment ? 'bg-green-500' : 'bg-slate-300'
        )}>
          <div className={cn(
            'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
            registerPayment ? 'left-6' : 'left-1'
          )} />
        </div>
      </button>

      {/* Campos de cobro — solo si está activado */}
      {registerPayment && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
          {/* Total */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total a cobrar
            </label>
            <div className="relative mt-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={disabled}
                value={(manualTotal ?? computedTotal) || ''}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onManualTotalChange(isNaN(v) ? null : v);
                }}
                placeholder={formatCurrency(computedTotal)}
                className="h-14 w-full rounded-xl border-2 border-slate-200 bg-slate-50
                           pl-9 pr-4 text-right text-2xl font-bold text-slate-900
                           focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>
            {manualTotal !== null && manualTotal !== computedTotal && (
              <button
                type="button"
                onClick={() => onManualTotalChange(null)}
                className="mt-1 text-xs text-blue-600"
              >
                Restablecer a {formatCurrency(computedTotal)}
              </button>
            )}
          </div>

          {/* Método de pago */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cobrado con
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                { method: 'cash' as const, label: 'Efectivo', icon: Banknote },
                { method: 'transfer' as const, label: 'Transferencia', icon: SendHorizonal },
              ]).map(({ method, label, icon: Icon }) => (
                <button
                  key={method}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPaymentMethodChange(method)}
                  className={cn(
                    'flex h-14 items-center justify-center gap-2 rounded-xl border-2',
                    'text-sm font-semibold transition-all active:scale-95',
                    paymentMethod === method
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre del cliente (opcional) */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cliente (opcional)
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              disabled={disabled}
              placeholder="Nombre o descripción…"
              className="mt-1 h-12 w-full rounded-xl border-2 border-slate-200 px-4 text-base
                         focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
