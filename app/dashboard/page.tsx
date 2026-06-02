'use client';

import { useRouter } from 'next/navigation';

import { Download, Loader2, RefreshCw, ShieldX } from 'lucide-react';

import { DateFilter } from '@/components/dashboard/DateFilter';
import { LowStockAlerts } from '@/components/dashboard/LowStockAlerts';
import { PaymentSummary } from '@/components/dashboard/PaymentSummary';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { StockMovementsTable } from '@/components/dashboard/StockMovementsTable';
import { TopProductsTable } from '@/components/dashboard/TopProductsTable';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { exportToCSV } from '@/lib/utils/csv';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { user, can, loading: authLoading } = useAuth();
  const establishmentId = user?.establishment_id ?? null;

  const {
    dateRange, movementFilter,
    stats, chartData, topProducts, movements, lowStock,
    isLoading, loadingMovements, loadingLowStock,
    setPreset, setCustomRange, setMovementFilter,
    refetchAll,
  } = useDashboard(establishmentId);

  // ── Guards ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!can('reports.view')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-6">
        <ShieldX className="h-10 w-10 text-red-400" />
        <h2 className="text-lg font-semibold text-slate-800">Sin acceso al dashboard</h2>
        <p className="text-sm text-slate-500">Solo el dueño puede ver estas estadísticas.</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">
          Volver
        </button>
      </div>
    );
  }

  function handleExportSales() {
    exportToCSV(
      chartData.map((d) => ({
        Fecha: d.rawDate,
        Total: d.total,
        Transacciones: d.transactions,
      })),
      `ventas-${formatDate(dateRange.start, 'yyyy-MM-dd')}-${formatDate(dateRange.end, 'yyyy-MM-dd')}`
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {user?.full_name ?? 'Dueño'} · Panel de control
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilter
            dateRange={dateRange}
            onPreset={setPreset}
            onCustomRange={setCustomRange}
          />
          <button
            onClick={refetchAll}
            title="Actualizar"
            className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleExportSales}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300
                       px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Exportar ventas
          </button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <StatsCards stats={stats} isLoading={isLoading} />

      {/* Gráfico de ventas */}
      <SalesChart data={chartData} isLoading={isLoading} />

      {/* Top productos + Métodos de pago */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TopProductsTable products={topProducts} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-2">
          <PaymentSummary stats={stats} isLoading={isLoading} />
        </div>
      </div>

      {/* Movimientos de stock */}
      <StockMovementsTable
        movements={movements}
        filter={movementFilter}
        onFilterChange={setMovementFilter}
        isLoading={loadingMovements}
      />

      {/* Alertas de stock bajo */}
      <LowStockAlerts items={lowStock} isLoading={loadingLowStock} />
    </div>
  );
}
