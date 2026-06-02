import { Download, Medal } from 'lucide-react';

import { exportToCSV } from '@/lib/utils/csv';
import { formatCurrency } from '@/lib/utils';
import type { TopProduct } from '@/hooks/useDashboard';

interface Props {
  products: TopProduct[];
  isLoading: boolean;
}

const MEDAL_COLORS = ['text-yellow-500', 'text-slate-400', 'text-amber-600'];

export function TopProductsTable({ products, isLoading }: Props) {
  function handleExport() {
    exportToCSV(
      products.map((p, i) => ({
        Posición: i + 1,
        Producto: p.productName,
        Barcode: p.barcode,
        'Cantidad vendida': p.totalQuantity,
        'Revenue total': p.totalRevenue,
        'N° ventas': p.saleCount,
      })),
      'top-productos',
      {}
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Productos más vendidos</h2>
        {products.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5
                       py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
              <div className="flex-1">
                <div className="h-3.5 w-40 animate-pulse rounded bg-slate-100" />
                <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Sin ventas en el período seleccionado
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unidades</th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map((p, i) => (
                <tr key={`${p.barcode}-${i}`} className="group hover:bg-slate-50">
                  <td className="py-2.5 pr-3 text-sm">
                    {i < 3 ? (
                      <Medal className={`h-4 w-4 ${MEDAL_COLORS[i] ?? 'text-slate-400'}`} />
                    ) : (
                      <span className="font-mono text-xs text-slate-400">{i + 1}</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">
                      {p.productName}
                    </p>
                    {p.barcode && (
                      <p className="font-mono text-xs text-slate-400">{p.barcode}</p>
                    )}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-sm font-semibold text-slate-900">
                    {p.totalQuantity.toLocaleString('es-AR')}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-sm text-slate-700">
                    {formatCurrency(p.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
