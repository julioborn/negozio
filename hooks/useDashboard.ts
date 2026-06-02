'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  endOfDay, endOfMonth, endOfWeek,
  startOfDay, startOfMonth, startOfWeek, subDays,
} from 'date-fns';

import { createClient } from '@/lib/supabase/client';
import { formatShortDate } from '@/lib/utils';

// ─── Tipos de datos del dashboard ────────────────────────────

export type DatePreset = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  preset: DatePreset;
  start: Date;
  end: Date;
}

export interface DashboardStats {
  totalSales: number;
  transactionCount: number;
  avgTicket: number;
  lowStockCount: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  otherTotal: number;
}

export interface SalesChartPoint {
  date: string;      // 'DD MMM'
  rawDate: string;   // 'YYYY-MM-DD' para el tooltip
  total: number;
  transactions: number;
}

export interface TopProduct {
  productName: string;
  barcode: string;
  totalQuantity: number;
  totalRevenue: number;
  saleCount: number;
}

export interface StockMovementRow {
  id: string;
  productName: string;
  brand: string | null;
  barcode: string | null;
  type: 'in' | 'out' | 'adjustment';
  reason: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  createdByName: string | null;
  createdAt: string;
}

export interface LowStockItem {
  id: string;
  name: string;
  brand: string | null;
  barcode: string;
  stock: number;
  stockMinAlert: number;
  price: number;
}

export interface MovementFilter {
  type: 'all' | 'in' | 'out' | 'adjustment';
  reason: string;
}

// ─── Helpers de fecha ─────────────────────────────────────────

function presetToRange(preset: Exclude<DatePreset, 'custom'>): DateRange {
  const now = new Date();
  const ranges: Record<Exclude<DatePreset, 'custom'>, DateRange> = {
    today: { preset, start: startOfDay(now), end: endOfDay(now) },
    week:  { preset, start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) },
    month: { preset, start: startOfMonth(now), end: endOfMonth(now) },
  };
  return ranges[preset];
}

// ─── Hook principal ───────────────────────────────────────────

export function useDashboard(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);

  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('today'));
  const [movementFilter, setMovementFilter] = useState<MovementFilter>({ type: 'all', reason: 'all' });

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<SalesChartPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [loadingLowStock, setLoadingLowStock] = useState(true);

  // ── Fetch estadísticas + métodos de pago ─────────────────
  const fetchStats = useCallback(async () => {
    if (!establishmentId) return;
    setLoadingStats(true);
    try {
      const { data } = await supabase.rpc('get_dashboard_stats', {
        p_establishment_id: establishmentId,
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
      });
      if (data) {
        setStats({
          totalSales: Number(data.total_sales ?? 0),
          transactionCount: Number(data.transaction_count ?? 0),
          avgTicket: Number(data.avg_ticket ?? 0),
          lowStockCount: Number(data.low_stock_count ?? 0),
          cashTotal: Number(data.cash_total ?? 0),
          cardTotal: Number(data.card_total ?? 0),
          transferTotal: Number(data.transfer_total ?? 0),
          otherTotal: Number(data.other_total ?? 0),
        });
      }
    } finally {
      setLoadingStats(false);
    }
  }, [supabase, establishmentId, dateRange]);

  // ── Fetch gráfico (últimos 30 días, fijo) ────────────────
  const fetchChart = useCallback(async () => {
    if (!establishmentId) return;
    setLoadingChart(true);
    try {
      const thirtyDaysAgo = subDays(new Date(), 29);

      const { data } = await supabase
        .from('v_daily_sales')
        .select('sale_date, total_amount, transaction_count')
        .eq('establishment_id', establishmentId)
        .gte('sale_date', thirtyDaysAgo.toISOString().split('T')[0]!)
        .order('sale_date', { ascending: true });

      // Llenar días sin ventas con 0
      const map = new Map<string, { total: number; transactions: number }>();
      (data ?? []).forEach((row: { sale_date: string; total_amount: number; transaction_count: number }) => {
        map.set(row.sale_date, {
          total: Number(row.total_amount ?? 0),
          transactions: Number(row.transaction_count ?? 0),
        });
      });

      const points: SalesChartPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = d.toISOString().split('T')[0]!;
        const v = map.get(key);
        points.push({
          date: formatShortDate(d),
          rawDate: key,
          total: v?.total ?? 0,
          transactions: v?.transactions ?? 0,
        });
      }
      setChartData(points);
    } finally {
      setLoadingChart(false);
    }
  }, [supabase, establishmentId]);

  // ── Fetch top productos ───────────────────────────────────
  const fetchTopProducts = useCallback(async () => {
    if (!establishmentId) return;
    setLoadingTop(true);
    try {
      const { data } = await supabase.rpc('get_top_products_range', {
        p_establishment_id: establishmentId,
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
        p_limit: 10,
      });
      setTopProducts(
        (data ?? []).map((r: { product_name: string; barcode: string; total_quantity: number; total_revenue: number; sale_count: number }) => ({
          productName: r.product_name,
          barcode: r.barcode,
          totalQuantity: Number(r.total_quantity),
          totalRevenue: Number(r.total_revenue),
          saleCount: Number(r.sale_count),
        }))
      );
    } finally {
      setLoadingTop(false);
    }
  }, [supabase, establishmentId, dateRange]);

  // ── Fetch movimientos de stock ────────────────────────────
  const fetchMovements = useCallback(async () => {
    if (!establishmentId) return;
    setLoadingMovements(true);
    try {
      let query = supabase
        .from('v_stock_movements_detail')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (movementFilter.type !== 'all') query = query.eq('type', movementFilter.type);
      if (movementFilter.reason !== 'all') query = query.eq('reason', movementFilter.reason);

      const { data } = await query;
      setMovements(
        (data ?? []).map((r: {
          id: string; product_name: string; brand: string | null; barcode: string | null;
          type: 'in' | 'out' | 'adjustment'; reason: string;
          quantity: number; previous_stock: number; new_stock: number;
          created_by_name: string | null; created_at: string;
        }) => ({
          id: r.id,
          productName: r.product_name,
          brand: r.brand,
          barcode: r.barcode,
          type: r.type,
          reason: r.reason,
          quantity: Number(r.quantity),
          previousStock: Number(r.previous_stock),
          newStock: Number(r.new_stock),
          createdByName: r.created_by_name,
          createdAt: r.created_at,
        }))
      );
    } finally {
      setLoadingMovements(false);
    }
  }, [supabase, establishmentId, movementFilter]);

  // ── Fetch stock bajo ──────────────────────────────────────
  const fetchLowStock = useCallback(async () => {
    if (!establishmentId) return;
    setLoadingLowStock(true);
    try {
      const { data } = await supabase
        .from('v_current_stock')
        .select('id, name, brand, barcode, stock, stock_min_alert, price')
        .eq('establishment_id', establishmentId)
        .eq('is_low_stock', true)
        .order('stock', { ascending: true });

      setLowStock(
        (data ?? []).map((r: {
          id: string; name: string; brand: string | null; barcode: string;
          stock: number; stock_min_alert: number; price: number;
        }) => ({
          id: r.id,
          name: r.name,
          brand: r.brand,
          barcode: r.barcode,
          stock: Number(r.stock),
          stockMinAlert: Number(r.stock_min_alert),
          price: Number(r.price),
        }))
      );
    } finally {
      setLoadingLowStock(false);
    }
  }, [supabase, establishmentId]);

  // Carga inicial y cuando cambia el rango de fechas
  useEffect(() => {
    fetchStats();
    fetchChart();
    fetchTopProducts();
  }, [fetchStats, fetchChart, fetchTopProducts]);

  // Solo cuando cambia el filtro de movimientos
  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  // Solo una vez (stock bajo no depende de fechas)
  useEffect(() => { fetchLowStock(); }, [fetchLowStock]);

  // ── Cambiar presets de fecha ──────────────────────────────
  const setPreset = useCallback((preset: Exclude<DatePreset, 'custom'>) => {
    setDateRange(presetToRange(preset));
  }, []);

  const setCustomRange = useCallback((start: Date, end: Date) => {
    setDateRange({ preset: 'custom', start: startOfDay(start), end: endOfDay(end) });
  }, []);

  const isLoading = loadingStats || loadingChart || loadingTop;

  return {
    // Estado
    dateRange,
    movementFilter,
    stats,
    chartData,
    topProducts,
    movements,
    lowStock,
    isLoading,
    loadingMovements,
    loadingLowStock,

    // Acciones
    setPreset,
    setCustomRange,
    setMovementFilter,
    refetchAll: () => {
      fetchStats();
      fetchChart();
      fetchTopProducts();
      fetchMovements();
      fetchLowStock();
    },
  };
}
