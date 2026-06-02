'use client';

import { useEffect, useRef } from 'react';

import { AlertTriangle, Banknote, CreditCard, Loader2, SendHorizonal, XCircle } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { PaymentMethod } from '@/types/database';

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { method: 'cash',     label: 'Efectivo',     icon: Banknote },
  { method: 'card',     label: 'Tarjeta',      icon: CreditCard },
  { method: 'transfer', label: 'Transferencia', icon: SendHorizonal },
];

// Billetetes comunes para sugerir como monto recibido
const BILL_SUGGESTIONS = [500, 1000, 2000, 5000, 10000];

interface Props {
  subtotal: number;
  total: number;
  globalDiscount: number;
  paymentMethod: PaymentMethod | null;
  amountReceived: number | null;
  change: number | null;
  itemCount: number;
  isProcessing: boolean;
  error: string | null;
  onSetPaymentMethod: (m: PaymentMethod) => void;
  onSetDiscount: (pct: number) => void;
  onSetAmountReceived: (n: number | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isDark?: boolean;
}

export function PaymentPanel({
  subtotal, total, globalDiscount, paymentMethod, amountReceived,
  change, itemCount, isProcessing, error,
  onSetPaymentMethod, onSetDiscount, onSetAmountReceived, onConfirm, onCancel,
  isDark = true,
}: Props) {
  // Clases del tema
  const bg        = isDark ? 'bg-gray-950 text-white'            : 'bg-slate-50 text-slate-900';
  const border    = isDark ? 'border-gray-800'                   : 'border-slate-200';
  const label     = isDark ? 'text-gray-500'                     : 'text-slate-500';
  const inputCls  = isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-slate-300 bg-white text-slate-900';
  const btnMuted  = isDark ? 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                           : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700';
  const amountRef = useRef<HTMLInputElement>(null);
  const canConfirm =
    itemCount > 0 &&
    paymentMethod !== null &&
    !isProcessing &&
    (paymentMethod !== 'cash' || (amountReceived != null && amountReceived >= total));

  // Enfocar campo de monto cuando se selecciona efectivo
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [paymentMethod]);

  // Enter confirma venta si está todo ok
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F12' && canConfirm) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canConfirm, onConfirm]);

  const discountAmount = subtotal - total;

  return (
    <div className={`flex h-full flex-col ${bg}`}>

      {/* ── Totales ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center gap-3 px-6 py-4">

        {/* Subtotal y descuento */}
        <div className={`space-y-1.5 border-b pb-4 ${border}`}>
          <div className="flex items-center justify-between text-sm">
            <span className={label}>Subtotal</span>
            <span className={`tabular-nums ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm ${label}`}>Descuento</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={0} max={100} step={1}
                value={globalDiscount || ''} placeholder="0"
                onChange={(e) => { const v = parseFloat(e.target.value); onSetDiscount(isNaN(v) ? 0 : v); }}
                className={`w-16 rounded-lg border py-1 text-right text-sm focus:outline-none ${inputCls}`}
              />
              <span className={`text-sm ${label}`}>%</span>
              {discountAmount > 0 && (
                <span className="tabular-nums text-sm text-green-500">-{formatCurrency(discountAmount)}</span>
              )}
            </div>
          </div>
        </div>

        {/* TOTAL */}
        <div className="flex flex-col items-center gap-1 py-2">
          <span className={`text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>Total</span>
          <span className={`text-6xl font-black tabular-nums leading-none tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {formatCurrency(total)}
          </span>
          <span className={`text-xs ${isDark ? 'text-gray-700' : 'text-slate-400'}`}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* ── Método de pago ────────────────────────────────────── */}
      <div className={`border-t px-6 py-4 ${border}`}>
        <p className={`mb-2 text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>
          Método de pago
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_OPTIONS.map(({ method, label, icon: Icon }) => (
            <button
              key={method}
              onClick={() => onSetPaymentMethod(method)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold
                transition-all ${
                  paymentMethod === method
                    ? 'border-primary-500 bg-primary-700 text-white shadow-lg shadow-primary-900/30'
                    : isDark
                      ? 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>

        {/* Campo de monto recibido (solo para efectivo) */}
        {paymentMethod === 'cash' && (
          <div className="mt-4 space-y-3">
            <div>
              <label className={`text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>
                Monto recibido
              </label>
              <div className="relative mt-1">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-lg ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>$</span>
                <input
                  ref={amountRef}
                  type="number" step="0.01" min={0}
                  value={amountReceived ?? ''}
                  onChange={(e) => { const v = parseFloat(e.target.value); onSetAmountReceived(isNaN(v) ? null : v); }}
                  placeholder="0.00"
                  className={`w-full rounded-xl border py-3 pl-8 pr-4 text-right text-xl font-bold
                             focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BILL_SUGGESTIONS.filter(b => b >= Math.floor(total / 100) * 100).slice(0, 4).map((bill) => (
                  <button key={bill} onClick={() => onSetAmountReceived(bill)} className={`rounded-lg border px-2.5 py-1 text-xs ${btnMuted}`}>
                    ${bill.toLocaleString('es-AR')}
                  </button>
                ))}
              </div>
            </div>

            {/* Vuelto */}
            {change !== null && change >= 0 && (
              <div className="flex items-center justify-between rounded-xl bg-green-950/50
                              border border-green-900 px-4 py-3">
                <span className="text-sm font-semibold text-green-400">Vuelto</span>
                <span className="text-2xl font-black tabular-nums text-green-400">
                  {formatCurrency(change)}
                </span>
              </div>
            )}

            {amountReceived != null && amountReceived > 0 && amountReceived < total && (
              <p className="text-center text-xs text-red-400">
                Faltan {formatCurrency(total - amountReceived)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className={`mx-4 mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-red-400 ${isDark ? 'border-red-900 bg-red-950/60' : 'border-red-200 bg-red-50 text-red-600'}`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Botones de acción ─────────────────────────────────── */}
      <div className="space-y-2 px-4 pb-4">
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className={`relative flex w-full items-center justify-center gap-3 rounded-2xl
            py-5 text-2xl font-black uppercase tracking-wide transition-all
            focus:outline-none focus:ring-4 focus:ring-green-600/30
            ${canConfirm
              ? 'bg-accent-600 text-white shadow-lg shadow-green-900/40 hover:bg-accent-500 active:scale-[0.98]'
              : `cursor-not-allowed ${isDark ? 'bg-gray-900 text-gray-700' : 'bg-slate-100 text-slate-400'}`
            }`}
        >
          {isProcessing ? <Loader2 className="h-7 w-7 animate-spin" /> : 'COBRAR'}
          {canConfirm && !isProcessing && (
            <span className="absolute right-4 rounded bg-accent-700 px-2 py-0.5 text-xs font-normal">F12</span>
          )}
        </button>

        {itemCount > 0 && (
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5
                       text-sm transition-colors disabled:opacity-40
                       ${isDark ? 'text-gray-700 hover:bg-gray-900 hover:text-red-400' : 'text-slate-400 hover:bg-slate-100 hover:text-red-500'}`}
          >
            <XCircle className="h-4 w-4" />
            Cancelar venta
          </button>
        )}
      </div>
    </div>
  );
}
