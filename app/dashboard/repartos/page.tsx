'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Banknote, Check, ChevronDown, ChevronUp, Clock,
  CreditCard, DollarSign, Loader2, MapPin, Package,
  Pencil, Trash2, Truck, Users, X,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { NumPad } from '@/components/ui/SoftKeyboard';
import type { Customer, Delivery, DeliveryItem, Profile, TravelStock, TravelStockItem } from '@/types/database';

const RepartoMap = dynamic(() => import('@/components/ui/RepartoMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-xl bg-slate-100">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  ),
});

// ─── Tipos ────────────────────────────────────────────────────
interface Waypoint {
  lat: number; lng: number; recorded_at: string;
  type?: 'route' | 'delivery';
  customer_name?: string | null;
  total_amount?: number | null;
}

type ProfileMin = Pick<Profile, 'id' | 'full_name' | 'email' | 'role'>;

interface RepartoDetail extends Omit<TravelStock, 'assigned_profile'> {
  assigned_profile?: ProfileMin;
  items:      TravelStockItem[];
  deliveries: (Delivery & { customer: Customer; items: DeliveryItem[] })[];
  waypoints:  Waypoint[];
}

type Section = 'productos' | 'ventas' | 'mapa';

// ─── Helpers ──────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  active: 'Activo', completed: 'Completado', cancelled: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-slate-100 text-slate-500',
};
const PAY_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  cash:       { label: 'Efectivo',        color: 'text-green-700 bg-green-50 border-green-200',    icon: Banknote   },
  transfer:   { label: 'Transferencia',   color: 'text-blue-700 bg-blue-50 border-blue-200',        icon: CreditCard },
  pending_7:  { label: 'Pendiente 7d',   color: 'text-amber-700 bg-amber-50 border-amber-200',     icon: Clock      },
  pending_15: { label: 'Pendiente 15d',  color: 'text-orange-700 bg-orange-50 border-orange-200',  icon: Clock      },
};

function fDate(s: string) {
  return new Date(s).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function payLabel(m: string | null): string {
  return m ? (PAY_CFG[m]?.label ?? m) : 'Sin método';
}

// ─── Sub-sección colapsable ────────────────────────────────────
function CollapseSection({
  title, icon: Icon, count, open, onToggle, children,
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</span>
          {count !== undefined && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {count}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-slate-400" />
          : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function RepartosPage() {
  const { user }   = useAuth();
  const estId      = user?.establishment_id ?? null;
  const supabase   = useMemo(() => createClient(), []);

  const [repartos,      setRepartos]      = useState<RepartoDetail[]>([]);
  const [profiles,      setProfiles]      = useState<ProfileMin[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  // Secciones abiertas dentro del reparto expandido
  const [openSections,  setOpenSections]  = useState<Set<Section>>(new Set<Section>(['ventas']));

  // Edición de precio
  const [editPrice,  setEditPrice]  = useState<{ itemId: string; epId: string | null; value: string } | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);

  // Borrar reparto
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  // ── Lista de repartos + perfiles ──────────────────────────
  useEffect(() => {
    if (!estId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [tsRes, profRes] = await Promise.all([
        supabase
          .from('travel_stocks')
          .select('*')
          .eq('establishment_id', estId)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('establishment_id', estId),
      ]);
      if (cancelled) return;
      setProfiles((profRes.data ?? []) as ProfileMin[]);
      setRepartos((tsRes.data ?? []).map((ts: TravelStock) => ({
        ...ts, items: [], deliveries: [], waypoints: [],
      })));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [estId, supabase]);

  // ── Detalle al expandir ───────────────────────────────────
  const loadDetail = useCallback(async (tsId: string) => {
    setDetailLoading(tsId);
    const [itemsRes, deliveriesRes, waypointsRes] = await Promise.all([
      supabase.from('travel_stock_items').select('*').eq('travel_stock_id', tsId).order('created_at'),
      supabase.from('deliveries').select('*, customer:customers(*), items:delivery_items(*)').eq('travel_stock_id', tsId).order('created_at'),
      supabase.from('reparto_waypoints').select('lat,lng,recorded_at,type,customer_name,total_amount').eq('travel_stock_id', tsId).order('recorded_at'),
    ]);
    setRepartos(prev => prev.map(r => r.id === tsId ? {
      ...r,
      items:      (itemsRes.data ?? [])      as TravelStockItem[],
      deliveries: (deliveriesRes.data ?? []) as (Delivery & { customer: Customer; items: DeliveryItem[] })[],
      waypoints:  (waypointsRes.data ?? [])  as Waypoint[],
    } : r));
    setDetailLoading(null);
  }, [supabase]);

  function toggle(tsId: string) {
    if (expanded === tsId) { setExpanded(null); return; }
    setExpanded(tsId);
    setEditPrice(null);
    setOpenSections(new Set<Section>(['ventas'])); // abre ventas por defecto
    const rep = repartos.find(r => r.id === tsId);
    if (rep && rep.items.length === 0) loadDetail(tsId);
  }

  function toggleSection(s: Section) {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  // ── Guardar precio ────────────────────────────────────────
  async function savePrice() {
    if (!editPrice) return;
    const price = parseFloat(editPrice.value.replace(',', '.'));
    if (isNaN(price) || price <= 0) return;
    setSavingPrice(true);
    await supabase.from('travel_stock_items').update({ unit_price: price }).eq('id', editPrice.itemId);
    if (editPrice.epId) {
      await supabase.from('establishment_products').update({ price }).eq('id', editPrice.epId);
    }
    setRepartos(prev => prev.map(r => ({
      ...r,
      items: r.items.map(it => it.id === editPrice.itemId ? { ...it, unit_price: price } : it),
    })));
    setSavingPrice(false);
    setEditPrice(null);
  }

  async function deleteReparto(tsId: string) {
    setDeletingId(tsId);
    setConfirmDeleteId(null);
    try {
      // Buscar IDs de deliveries para borrar sus items
      const { data: dels } = await supabase.from('deliveries').select('id').eq('travel_stock_id', tsId);
      const delIds = (dels ?? []).map((d: { id: string }) => d.id);
      if (delIds.length > 0) {
        await supabase.from('delivery_items').delete().in('delivery_id', delIds);
        await supabase.from('deliveries').delete().in('id', delIds);
      }
      await supabase.from('reparto_waypoints').delete().eq('travel_stock_id', tsId);
      await supabase.from('travel_stock_items').delete().eq('travel_stock_id', tsId);
      await supabase.from('travel_stocks').delete().eq('id', tsId);
      setRepartos(prev => prev.filter(r => r.id !== tsId));
      if (expanded === tsId) setExpanded(null);
    } catch {
      alert('Error al eliminar el reparto');
    } finally {
      setDeletingId(null);
    }
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

      {/* Encabezado */}
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

      {/* Lista */}
      <div className="space-y-3">
        {repartos.map(rep => {
          const isOpen      = expanded === rep.id;
          const isLoadingDt = detailLoading === rep.id;
          const assignedProfile = profiles.find(p => p.id === rep.assigned_to);

          // Stats del reparto (solo cuando está cargado el detalle)
          const totalVendido = rep.deliveries.reduce((s, d) => s + d.total_amount, 0);
          const cobrado      = rep.deliveries.filter(d => d.payment_status === 'paid').reduce((s, d) => s + d.total_amount, 0);
          const pendiente    = rep.deliveries.filter(d => d.payment_status === 'pending').reduce((s, d) => s + d.total_amount, 0);

          return (
            <div key={rep.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              {/* ── Cabecera ── */}
              <div className="flex items-center gap-2 pr-3">
                <button
                  onClick={() => toggle(rep.id)}
                  className="flex flex-1 items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors min-w-0"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    rep.status === 'active' ? 'bg-green-100' : rep.status === 'completed' ? 'bg-blue-100' : 'bg-slate-100'
                  }`}>
                    <Truck className={`h-5 w-5 ${
                      rep.status === 'active' ? 'text-green-600' : rep.status === 'completed' ? 'text-blue-600' : 'text-slate-400'
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {assignedProfile?.full_name ?? 'Sin asignar'}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[rep.status]}`}>
                        {STATUS_LABELS[rep.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{fDate(rep.created_at)}</p>
                    {rep.deliveries.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {rep.deliveries.length} entrega{rep.deliveries.length !== 1 ? 's' : ''} · {formatCurrency(totalVendido)}
                        {pendiente > 0 && <span className="ml-1 font-semibold text-amber-600">· {formatCurrency(pendiente)} pend.</span>}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-slate-400">
                    {isLoadingDt
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </button>
                {/* Botón borrar */}
                <button
                  onClick={() => setConfirmDeleteId(rep.id === confirmDeleteId ? null : rep.id)}
                  disabled={deletingId === rep.id}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-400 hover:bg-red-100 disabled:opacity-40 transition-colors"
                  title="Eliminar reparto"
                >
                  {deletingId === rep.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </div>

              {/* ── Confirmación de borrado ── */}
              {confirmDeleteId === rep.id && (
                <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">¿Eliminar este reparto y todas sus ventas? No se puede deshacer.</p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => deleteReparto(rep.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}

              {/* ── Detalle ── */}
              {isOpen && !isLoadingDt && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-3">

                  {/* ── Participantes ── */}
                  {rep.deliveries.length > 0 && (() => {
                    const participantIds = Array.from(new Set(rep.deliveries.map(d => d.sold_by)));
                    const participants   = participantIds.map(id => profiles.find(p => p.id === id)).filter(Boolean);
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="text-[11px] font-medium text-slate-400">Participaron:</span>
                        {participants.map(p => (
                          <span key={p!.id} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                            {p!.full_name}
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ── Mini stats dentro de la card ── */}
                  {rep.deliveries.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-center">
                        <p className="text-xs text-slate-400">Total</p>
                        <p className="text-sm font-black text-slate-800 tabular-nums">{formatCurrency(totalVendido)}</p>
                      </div>
                      <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2.5 text-center">
                        <p className="text-xs text-green-500">Cobrado</p>
                        <p className="text-sm font-black text-green-700 tabular-nums">{formatCurrency(cobrado)}</p>
                      </div>
                      <div className={`rounded-xl px-3 py-2.5 text-center ${
                        pendiente > 0
                          ? 'border border-amber-100 bg-amber-50'
                          : 'border border-slate-100 bg-slate-50'
                      }`}>
                        <p className={`text-xs ${pendiente > 0 ? 'text-amber-500' : 'text-slate-400'}`}>Pendiente</p>
                        <p className={`text-sm font-black tabular-nums ${pendiente > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                          {formatCurrency(pendiente)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Barra de progreso cobro ── */}
                  {rep.deliveries.length > 0 && totalVendido > 0 && (
                    <div>
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        {(() => {
                          const methodTotals: Record<string, number> = {};
                          for (const d of rep.deliveries) {
                            const k = d.payment_method ?? 'pending_7';
                            methodTotals[k] = (methodTotals[k] ?? 0) + d.total_amount;
                          }
                          return Object.entries(methodTotals).map(([method, amt]) => {
                            const cfg = PAY_CFG[method];
                            if (!cfg) return null;
                            const Icon = cfg.icon;
                            return (
                              <span key={method} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
                                <Icon className="h-3 w-3" />
                                {cfg.label} {formatCurrency(amt)}
                              </span>
                            );
                          });
                        })()}
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${(cobrado / totalVendido) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Sección: Productos cargados ── */}
                  {rep.items.length > 0 && (
                    <CollapseSection
                      title="Productos cargados"
                      icon={Package}
                      count={rep.items.length}
                      open={openSections.has('productos')}
                      onToggle={() => toggleSection('productos')}
                    >
                      <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                        <div className="divide-y divide-slate-50">
                          {rep.items.map(item => {
                            const isEditing = editPrice?.itemId === item.id;
                            return (
                              <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-800">{item.product_name}</p>
                                    <div className="mt-0.5">
                                      {isEditing ? (
                                        <span className="text-xs font-bold text-primary-700">${editPrice.value || '0'}</span>
                                      ) : (
                                        <button
                                          onClick={() => setEditPrice({ itemId: item.id, epId: item.establishment_product_id, value: String(item.unit_price) })}
                                          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary-700 transition-colors"
                                        >
                                          {formatCurrency(item.unit_price)} c/u
                                          <Pencil className="h-3 w-3 opacity-50" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-sm font-bold text-slate-900">
                                      {item.quantity_sold} <span className="font-normal text-slate-400">/ {item.quantity_assigned}</span>
                                    </p>
                                    <p className="text-[10px] text-slate-400">vendido / cargado</p>
                                  </div>
                                </div>
                                {isEditing && (
                                  <div className="mt-3 rounded-xl border border-primary-200 bg-primary-50 p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="text-xs font-semibold text-primary-700">Nuevo precio</span>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={savePrice}
                                          disabled={savingPrice || !editPrice.value || parseFloat(editPrice.value) <= 0}
                                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-700 text-white disabled:opacity-50"
                                        >
                                          {savingPrice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                        </button>
                                        <button
                                          onClick={() => setEditPrice(null)}
                                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                    <NumPad value={editPrice.value} onChange={v => setEditPrice(prev => prev ? { ...prev, value: v } : prev)} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CollapseSection>
                  )}

                  {/* ── Sección: Ventas ── */}
                  {rep.deliveries.length > 0 && (
                    <CollapseSection
                      title="Ventas del reparto"
                      icon={Users}
                      count={rep.deliveries.length}
                      open={openSections.has('ventas')}
                      onToggle={() => toggleSection('ventas')}
                    >
                      <div className="overflow-y-auto space-y-2" style={{ maxHeight: 380 }}>
                        {rep.deliveries.map(d => {
                          const cfg              = PAY_CFG[d.payment_method ?? ''];
                          const sellerName       = profiles.find(p => p.id === d.sold_by)?.full_name;
                          const collectorName    = d.paid_by ? profiles.find(p => p.id === d.paid_by)?.full_name : null;
                          const collectedByOther = d.paid_by && d.paid_by !== d.sold_by;
                          const isPaid           = d.payment_status === 'paid';
                          return (
                            <div key={d.id} className={`overflow-hidden rounded-xl border-2 ${
                              isPaid ? 'border-green-200 bg-white' : 'border-amber-200 bg-white'
                            }`}>
                              {/* Cabecera */}
                              <div className={`flex items-center justify-between px-3 py-2 ${
                                isPaid ? 'bg-green-50' : 'bg-amber-50'
                              }`}>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-900">{d.customer.name}</p>
                                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                                    {d.customer.barrio && (
                                      <span className="flex items-center gap-0.5">
                                        <MapPin className="h-3 w-3" />{d.customer.barrio}
                                      </span>
                                    )}
                                    <span>{fDate(d.created_at)}</span>
                                  </div>
                                </div>
                                <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isPaid
                                    ? 'bg-green-100 text-green-700'
                                    : cfg?.color ?? 'bg-amber-100 text-amber-700'
                                }`}>
                                  {isPaid ? '✓ Cobrado' : payLabel(d.payment_method)}
                                </span>
                              </div>

                              {/* Líneas de productos */}
                              {d.items && d.items.length > 0 && (
                                <div className="px-3 py-2 space-y-1">
                                  {d.items.map(it => (
                                    <div key={it.id} className="flex items-baseline gap-2 text-sm">
                                      <span className="w-4 shrink-0 text-right font-bold tabular-nums text-slate-400">{it.quantity}</span>
                                      <span className="flex-1 truncate text-slate-700">{it.product_name}</span>
                                      <span className="shrink-0 tabular-nums text-slate-500">{formatCurrency(it.unit_price)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Separador punteado */}
                              <div className="mx-3 border-t border-dashed border-slate-200" />

                              {/* Total + meta */}
                              <div className="flex items-center justify-between px-3 py-2">
                                <div className="text-[11px] text-slate-400 space-y-0.5">
                                  {sellerName && (
                                    <p>Vendió: <span className="font-semibold text-slate-500">{sellerName}</span></p>
                                  )}
                                  {collectedByOther && collectorName && (
                                    <p>Cobró: <span className="font-semibold text-slate-500">{collectorName}</span></p>
                                  )}
                                </div>
                                <p className="text-base font-black tabular-nums text-slate-900">
                                  {formatCurrency(d.total_amount)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapseSection>
                  )}

                  {/* ── Sección: Mapa de ventas ── */}
                  {(() => {
                    // Cruza waypoints de entrega con el estado de pago real de la venta
                    const delivWps = rep.waypoints
                      .filter(w => w.type === 'delivery')
                      .map(w => {
                        // Buscar la venta correspondiente por nombre de cliente
                        const match = rep.deliveries.find(
                          d => d.customer.name === w.customer_name
                        );
                        return {
                          lat:            w.lat,
                          lng:            w.lng,
                          customer_name:  w.customer_name ?? 'Venta',
                          total_amount:   w.total_amount ?? 0,
                          created_at:     w.recorded_at,
                          payment_status: (match?.payment_status ?? 'paid') as 'paid' | 'pending',
                          payment_method: match?.payment_method ?? null,
                        };
                      });
                    const hasPoints = delivWps.length > 0;
                    return (
                      <CollapseSection
                        title="Ventas en el mapa"
                        icon={MapPin}
                        open={openSections.has('mapa')}
                        onToggle={() => toggleSection('mapa')}
                      >
                        {hasPoints ? (
                          <div className="h-64 overflow-hidden rounded-xl border border-slate-200">
                            <RepartoMap deliveryPoints={delivWps} />
                          </div>
                        ) : (
                          <div className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50">
                            <MapPin className="h-6 w-6 text-slate-300" />
                            <p className="text-xs text-slate-400">Sin puntos de venta registrados</p>
                          </div>
                        )}
                      </CollapseSection>
                    );
                  })()}

                  {rep.items.length === 0 && rep.deliveries.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-4">Sin datos para este reparto</p>
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
