import { Banknote, CreditCard, SendHorizonal } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { DashboardStats } from '@/hooks/useDashboard';

interface Props {
  stats: DashboardStats | null;
  isLoading: boolean;
}

export function PaymentSummary({ stats, isLoading }: Props) {
  const total = stats
    ? stats.cashTotal + stats.cardTotal + stats.transferTotal + stats.otherTotal
    : 0;

  const methods = [
    { label: 'Efectivo',       icon: Banknote,       amount: stats?.cashTotal ?? 0,     color: 'bg-green-500' },
    { label: 'Tarjeta',        icon: CreditCard,      amount: stats?.cardTotal ?? 0,     color: 'bg-blue-500' },
    { label: 'Transferencia',  icon: SendHorizonal,   amount: stats?.transferTotal ?? 0, color: 'bg-purple-500' },
    { label: 'Otro',           icon: Banknote,        amount: stats?.otherTotal ?? 0,    color: 'bg-slate-400' },
  ].filter((m) => m.amount > 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Métodos de pago</h2>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : methods.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Sin ventas en el período</p>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => {
            const pct = total > 0 ? (m.amount / total) * 100 : 0;
            return (
              <div key={m.label}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <m.icon className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-700">{m.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(m.amount)}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${m.color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="border-t border-slate-100 pt-2">
            <div className="flex justify-between text-sm font-semibold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
