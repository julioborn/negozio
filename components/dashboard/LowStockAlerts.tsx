import Link from 'next/link';

import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { LowStockItem } from '@/hooks/useDashboard';

interface Props {
  items: LowStockItem[];
  isLoading: boolean;
}

export function LowStockAlerts({ items, isLoading }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${items.length > 0 ? 'text-red-500' : 'text-slate-400'}`} />
          <h2 className="text-sm font-semibold text-slate-900">
            Alertas de stock bajo
            {items.length > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {items.length}
              </span>
            )}
          </h2>
        </div>
        {items.length > 0 && (
          <Link
            href="/dashboard/productos?lowStock=true"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
          <p className="text-sm font-medium text-green-700">Todo el stock está en niveles normales</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                {item.brand && <p className="text-xs text-slate-400">{item.brand}</p>}
                <p className="mt-0.5 text-xs text-slate-500">{formatCurrency(item.price)}</p>
              </div>
              <div className="ml-3 text-right shrink-0">
                <p className="text-lg font-black tabular-nums text-red-600">{item.stock}</p>
                <p className="text-xs text-slate-400">mín {item.stockMinAlert}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
