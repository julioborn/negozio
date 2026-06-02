'use client';

import { useRouter } from 'next/navigation';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, Loader2, RefreshCw, ShieldX, Sparkles } from 'lucide-react';

import { DateFilter }          from '@/components/dashboard/DateFilter';
import { LowStockAlerts }      from '@/components/dashboard/LowStockAlerts';
import { PaymentSummary }      from '@/components/dashboard/PaymentSummary';
import { SalesChart }          from '@/components/dashboard/SalesChart';
import { StatsCards }          from '@/components/dashboard/StatsCards';
import { StockMovementsTable } from '@/components/dashboard/StockMovementsTable';
import { TopProductsTable }    from '@/components/dashboard/TopProductsTable';
import { useAuth }             from '@/hooks/useAuth';
import { useDashboard }        from '@/hooks/useDashboard';
import { useAuthStore }        from '@/store/auth.store';
import { exportToCSV }         from '@/lib/utils/csv';
import { formatDate }          from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { user, can, loading: authLoading } = useAuth();
  const establishment = useAuthStore((s) => s.establishment);
  const establishmentId = user?.establishment_id ?? null;

  const {
    dateRange, movementFilter,
    stats, chartData, topProducts, movements, lowStock,
    isLoading, loadingMovements, loadingLowStock,
    setPreset, setCustomRange, setMovementFilter,
    refetchAll,
  } = useDashboard(establishmentId);

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
        <h2 className="text-lg font-semibold text-slate-800">Sin acceso</h2>
        <p className="text-sm text-slate-500">Solo el dueño puede ver estas estadísticas.</p>
        <button onClick={() => router.back()} className="text-sm text-primary-700 hover:underline">Volver</button>
      </div>
    );
  }

  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const today2 = today.charAt(0).toUpperCase() + today.slice(1);

  function handleExportSales() {
    exportToCSV(
      chartData.map((d) => ({ Fecha: d.rawDate, Total: d.total, Transacciones: d.transactions })),
      `ventas-${formatDate(dateRange.start, 'yyyy-MM-dd')}-${formatDate(dateRange.end, 'yyyy-MM-dd')}`
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 px-6 py-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary-300" />
              <p className="text-sm font-medium text-primary-200">{today2}</p>
            </div>
            <h1 className="text-2xl font-black leading-tight">
              {establishment?.name ?? 'Inicio'}
            </h1>
            <p className="mt-0.5 text-sm text-primary-200">
              Bienvenido, {user?.full_name?.split(' ')[0] ?? 'Dueño'} · Panel de control
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <button onClick={refetchAll} title="Actualizar"
              className="flex items-center justify-center rounded-xl bg-white/15 p-2.5 text-white hover:bg-white/25 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={handleExportSales}
              className="flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-white/25 transition-colors">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        </div>

        {/* Filtros de fecha — dentro del header */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <DateFilter dateRange={dateRange} onPreset={setPreset} onCustomRange={setCustomRange} />
        </div>
      </div>

      {/* ── Tarjetas resumen ──────────────────────────────── */}
      <StatsCards stats={stats} isLoading={isLoading} />

      {/* ── Gráfico ───────────────────────────────────────── */}
      <SalesChart data={chartData} isLoading={isLoading} />

      {/* ── Top productos + Métodos de pago ──────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TopProductsTable products={topProducts} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-2">
          <PaymentSummary stats={stats} isLoading={isLoading} />
        </div>
      </div>

      {/* ── Movimientos ──────────────────────────────────── */}
      <StockMovementsTable
        movements={movements}
        filter={movementFilter}
        onFilterChange={setMovementFilter}
        isLoading={loadingMovements}
      />

      {/* ── Alertas de stock bajo ────────────────────────── */}
      <LowStockAlerts items={lowStock} isLoading={loadingLowStock} />
    </div>
  );
}
