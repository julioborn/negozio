'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ChevronDown, ChevronUp, Clock, DollarSign,
  Loader2, MapPin, Package, Truck, Users,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import type { Customer, Delivery, DeliveryItem, Profile, TravelStock, TravelStockItem } from '@/types/database';

// Leaflet no soporta SSR — importar dinámicamente
const RepartoMap = dynamic(() => import('@/components/ui/RepartoMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-xl bg-slate-100">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  ),
});

// ─── Tipos extendidos ─────────────────────────────────────────
interface Waypoint {
  lat: number; lng: number; recorded_at: string;
  type?: 'route' | 'delivery';
  customer_name?: string | null;
  total_amount?: number | null;
}

interface RepartoDetail extends TravelStock {
  assigned_profile?: Profile;
  items:    TravelStockItem[];
  deliveries: (Delivery & { customer: Customer; items: DeliveryItem[] })[];
  waypoints:  Waypoint[];
}

// ─── Helpers ──────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  active: 'Activo', completed: 'Completado', cancelled: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-slate-100 text-slate-500',
};
const PAY_LABELS: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia',
  pending_7: 'Pendiente 7d', pending_15: 'Pendiente 15d',
};

function fDate(s: string) {
  return new Date(s).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Page ─────────────────────────────────────────────────────
export default function RepartosPage() {
  const { user }        = useAuth();
  const estId           = user?.establishment_id ?? null;
  const supabase        = useMemo(() => createClient(), []);

  const [repartos, setRepartos]     = useState<RepartoDetail[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  // ── Cargar lista de repartos ──────────────────────────────
  useEffect(() => {
    if (!estId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('travel_stocks')
        .select('*, assigned_profile:profiles!travel_stocks_assigned_to_fkey(*)')
        .eq('establishment_id', estId)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      setRepartos((data ?? []).map((ts: TravelStock & { assigned_profile?: Profile }) => ({
        ...ts,
        items:      [],
        deliveries: [],
        waypoints:  [],
      })));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [estId, supabase]);

  // ── Cargar detalle de un reparto al expandir ───────────────
  const loadDetail = useCallback(async (tsId: string) => {
    setDetailLoading(tsId);
    const [itemsRes, deliveriesRes, waypointsRes] = await Promise.all([
      supabase
        .from('travel_stock_items')
        .select('*')
        .eq('travel_stock_id', tsId)
        .order('created_at'),
      supabase
        .from('deliveries')
        .select('*, customer:customers(*), items:delivery_items(*)')
        .eq('travel_stock_id', tsId)
        .order('created_at'),
      supabase
        .from('reparto_waypoints')
        .select('lat, lng, recorded_at, type, customer_name, total_amount')
        .eq('travel_stock_id', tsId)
        .order('recorded_at'),
    ]);

    setRepartos(prev => prev.map(r => r.id === tsId ? {
      ...r,
      items:      (itemsRes.data ?? []) as TravelStockItem[],
      deliveries: (deliveriesRes.data ?? []) as (Delivery & { customer: Customer; items: DeliveryItem[] })[],
      waypoints:  (waypointsRes.data ?? []) as Waypoint[],
    } : r));
    setDetailLoading(null);
  }, [supabase]);

  function toggle(tsId: string) {
    if (expanded === tsId) { setExpanded(null); return; }
    setExpanded(tsId);
    const rep = repartos.find(r => r.id === tsId);
    if (rep && rep.items.length === 0) loadDetail(tsId);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-primary-700" />
        <h1 className="text-xl font-bold text-slate-900">Historial de repartos</h1>
        <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
          {repartos.length}
        </span>
      </div>

      {repartos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Truck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-500">No hay repartos registrados</p>
        </div>
      )}

      <div className="space-y-3">
        {repartos.map(rep => {
          const isOpen      = expanded === rep.id;
          const isLoadingDt = detailLoading === rep.id;
          const totalVendido = rep.deliveries.reduce((s, d) => s + d.total_amount, 0);

          return (
            <div key={rep.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              {/* ── Cabecera del reparto ── */}
              <button
                onClick={() => toggle(rep.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                  ${rep.status === 'active' ? 'bg-green-100' : rep.status === 'completed' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                  <Truck className={`h-5 w-5 ${rep.status === 'active' ? 'text-green-600' : rep.status === 'completed' ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">
                      {rep.assigned_profile?.full_name ?? 'Sin asignar'}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[rep.status]}`}>
                      {STATUS_LABELS[rep.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{fDate(rep.created_at)}</p>
                </div>

                <div className="hidden shrink-0 flex-col items-end sm:flex">
                  {isOpen && rep.deliveries.length > 0 && (
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(totalVendido)}</p>
                  )}
                  <p className="text-xs text-slate-400">{rep.name}</p>
                </div>

                <div className="shrink-0 text-slate-400">
                  {isLoadingDt
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />
                  }
                </div>
              </button>

              {/* ── Detalle expandido ── */}
              {isOpen && !isLoadingDt && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-5">

                  {/* Productos cargados */}
                  {rep.items.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-400" />
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Productos cargados ({rep.items.length})
                        </p>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-100">
                        {rep.items.map((item, i) => (
                          <div key={item.id}
                            className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-slate-800">{item.product_name}</p>
                              <p className="text-xs text-slate-400">{formatCurrency(item.unit_price)} c/u</p>
                            </div>
                            <div className="ml-4 text-right">
                              <p className="font-semibold text-slate-900">
                                {item.quantity_sold} / {item.quantity_assigned}
                              </p>
                              <p className="text-[10px] text-slate-400">vendido / cargado</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Entregas */}
                  {rep.deliveries.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-slate-400" />
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Entregas ({rep.deliveries.length})
                          </p>
                        </div>
                        <p className="text-sm font-bold text-slate-900">
                          Total: {formatCurrency(totalVendido)}
                        </p>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-100">
                        {rep.deliveries.map((d, i) => (
                          <div key={d.id}
                            className={`px-4 py-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900">{d.customer.name}</p>
                                {d.customer.barrio && (
                                  <p className="flex items-center gap-1 text-xs text-slate-400">
                                    <MapPin className="h-3 w-3" />{d.customer.barrio}
                                  </p>
                                )}
                                {/* Items de la entrega */}
                                {d.items && d.items.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {d.items.map(it => (
                                      <p key={it.id} className="text-xs text-slate-500">
                                        {it.quantity}× {it.product_name} — {formatCurrency(it.subtotal)}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="font-bold text-slate-900">{formatCurrency(d.total_amount)}</p>
                                <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
                                  d.payment_status === 'paid'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {d.payment_method ? PAY_LABELS[d.payment_method] ?? d.payment_method : 'Pendiente'}
                                </span>
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  <Clock className="inline h-3 w-3" /> {fDate(d.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mapa */}
                  {(() => {
                    const routeWps = rep.waypoints.filter(w => !w.type || w.type === 'route');
                    const delivWps = rep.waypoints
                      .filter(w => w.type === 'delivery' && w.customer_name)
                      .map(w => ({
                        lat:           w.lat,
                        lng:           w.lng,
                        customer_name: w.customer_name!,
                        total_amount:  w.total_amount ?? 0,
                        created_at:    w.recorded_at,
                      }));
                    const hasGps = routeWps.length > 0 || delivWps.length > 0;
                    return (
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recorrido</p>
                        </div>
                        {hasGps ? (
                          <div className="h-80 overflow-hidden rounded-xl border border-slate-200">
                            <RepartoMap waypoints={routeWps} deliveryPoints={delivWps} />
                          </div>
                        ) : (
                          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50">
                            <MapPin className="h-8 w-8 text-slate-300" />
                            <p className="text-sm text-slate-400">Sin datos de ubicación</p>
                            <p className="text-xs text-slate-300">El GPS se registrará en los próximos repartos</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Si no hay nada */}
                  {rep.items.length === 0 && rep.deliveries.length === 0 && (
                    <p className="text-center text-sm text-slate-400">Sin datos para este reparto</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
