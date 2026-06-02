'use client';

import { Download, SlidersHorizontal } from 'lucide-react';

import { exportToCSV } from '@/lib/utils/csv';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { MovementFilter, StockMovementRow } from '@/hooks/useDashboard';

const TYPE_LABELS: Record<string, { label: string; classes: string }> = {
  in:         { label: 'Entrada',  classes: 'bg-green-100 text-green-700' },
  out:        { label: 'Salida',   classes: 'bg-red-100 text-red-700' },
  adjustment: { label: 'Ajuste',   classes: 'bg-blue-100 text-blue-700' },
};

const REASON_LABELS: Record<string, string> = {
  supplier:      'Proveedor',
  sale:          'Venta POS',
  external_sale: 'Venta externa',
  return:        'Devolución',
  loss:          'Pérdida',
  manual:        'Manual',
  correction:    'Corrección',
};

interface Props {
  movements: StockMovementRow[];
  filter: MovementFilter;
  onFilterChange: (f: MovementFilter) => void;
  isLoading: boolean;
}

export function StockMovementsTable({ movements, filter, onFilterChange, isLoading }: Props) {
  function handleExport() {
    exportToCSV(
      movements.map((m) => ({
        Fecha:            formatDate(m.createdAt, 'dd/MM/yyyy HH:mm'),
        Producto:         m.productName,
        Barcode:          m.barcode ?? '',
        Tipo:             TYPE_LABELS[m.type]?.label ?? m.type,
        Razón:            REASON_LABELS[m.reason] ?? m.reason,
        Cantidad:         m.quantity,
        'Stock anterior': m.previousStock,
        'Stock nuevo':    m.newStock,
        Costo:            m.newStock,
        Operador:         m.createdByName ?? '',
      })),
      'movimientos-stock'
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Movimientos de stock</h2>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 ml-auto items-center">
          <select
            value={filter.type}
            onChange={(e) => onFilterChange({ ...filter, type: e.target.value as MovementFilter['type'] })}
            className="rounded-lg border border-slate-300 py-1.5 pl-2 pr-7 text-xs
                       text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos los tipos</option>
            <option value="in">Entradas</option>
            <option value="out">Salidas</option>
            <option value="adjustment">Ajustes</option>
          </select>

          <select
            value={filter.reason}
            onChange={(e) => onFilterChange({ ...filter, reason: e.target.value })}
            className="rounded-lg border border-slate-300 py-1.5 pl-2 pr-7 text-xs
                       text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todas las razones</option>
            {Object.entries(REASON_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {movements.length > 0 && (
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
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-slate-100">
              {['Fecha', 'Producto', 'Tipo', 'Razón', 'Cant.', 'Stock ant.', 'Stock nuevo', 'Operador'].map((h) => (
                <th key={h} className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((__, j) => (
                    <td key={j} className="py-2.5 pr-4">
                      <div className="h-3.5 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-slate-400">
                  Sin movimientos para los filtros seleccionados
                </td>
              </tr>
            ) : (
              movements.map((m) => {
                const typeInfo = TYPE_LABELS[m.type] ?? { label: m.type, classes: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(m.createdAt, 'dd/MM HH:mm')}
                    </td>
                    <td className="py-2.5 pr-4 max-w-[160px]">
                      <p className="truncate text-sm font-medium text-slate-900">{m.productName}</p>
                      {m.barcode && <p className="font-mono text-xs text-slate-400">{m.barcode}</p>}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', typeInfo.classes)}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600 whitespace-nowrap">
                      {REASON_LABELS[m.reason] ?? m.reason}
                    </td>
                    <td className={cn('py-2.5 pr-4 text-sm font-semibold tabular-nums',
                      m.type === 'in' ? 'text-green-600' : 'text-red-600')}>
                      {m.type === 'in' ? '+' : '-'}{m.quantity}
                    </td>
                    <td className="py-2.5 pr-4 text-sm tabular-nums text-slate-500">{m.previousStock}</td>
                    <td className="py-2.5 pr-4 text-sm font-semibold tabular-nums text-slate-900">{m.newStock}</td>
                    <td className="py-2.5 text-xs text-slate-400 truncate max-w-[100px]">
                      {m.createdByName ?? '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
