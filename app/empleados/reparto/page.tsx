'use client';

import { useCallback, useState } from 'react';

import { AlertTriangle, CheckCircle2, Loader2, Minus, Plus, ShoppingBag, Truck, X } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useCustomers } from '@/hooks/useCustomers';
import { useDeliveries, type DeliveryCartItem } from '@/hooks/useDeliveries';
import { useTravelStocks } from '@/hooks/useTravelStocks';
import { formatCurrency } from '@/lib/utils';
import type { TravelStockItem } from '@/types/database';

type PayStatus = 'paid' | 'pending';
type PageState = 'building' | 'confirmed';

export default function RepartoPage() {
  const { user } = useAuth();
  const establishmentId = user?.establishment_id ?? null;

  const { customers, isLoading: customersLoading } = useCustomers(establishmentId);
  const { travelStocks, fetchItems } = useTravelStocks(establishmentId);
  const { createDelivery, isConfirming, refetch: refetchDebts } = useDeliveries(establishmentId);

  const activeTravelStocks = travelStocks.filter((ts) => ts.status === 'active');

  const [selectedTs, setSelectedTs]       = useState<string>('');
  const [tsItems, setTsItems]             = useState<TravelStockItem[]>([]);
  const [loadingTs, setLoadingTs]         = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [cart, setCart]                   = useState<DeliveryCartItem[]>([]);
  const [payStatus, setPayStatus]         = useState<PayStatus>('paid');
  const [notes, setNotes]                 = useState('');
  const [error, setError]                 = useState<string | null>(null);
  const [pageState, setPageState]         = useState<PageState>('building');
  const [lastTotal, setLastTotal]         = useState(0);

  const handleSelectTs = useCallback(async (tsId: string) => {
    setSelectedTs(tsId);
    setCart([]);
    if (!tsId) { setTsItems([]); return; }
    setLoadingTs(true);
    const items = await fetchItems(tsId);
    setTsItems(items);
    setLoadingTs(false);
  }, [fetchItems]);

  function addToCart(item: TravelStockItem) {
    const remaining = item.quantity_assigned - item.quantity_sold;
    if (remaining <= 0) return;
    setCart((prev) => {
      const ex = prev.find((c) => c.epId === item.establishment_product_id);
      if (ex) {
        return prev.map((c) => c.epId === item.establishment_product_id
          ? { ...c, quantity: Math.min(c.quantity + 1, remaining) } : c);
      }
      return [...prev, {
        epId: item.establishment_product_id,
        name: item.product_name,
        quantity: 1,
        unitPrice: item.unit_price,
      }];
    });
  }

  function updateCartQty(epId: string, qty: number) {
    if (qty < 1) return;
    setCart((prev) => prev.map((c) => c.epId === epId ? { ...c, quantity: qty } : c));
  }

  const total = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  async function handleConfirm() {
    if (!selectedCustomer) { setError('Seleccioná un cliente'); return; }
    if (cart.length === 0) { setError('Agregá al menos un producto'); return; }
    setError(null);
    try {
      await createDelivery({
        travelStockId: selectedTs || null,
        customerId: selectedCustomer,
        paymentStatus: payStatus,
        notes,
        items: cart,
      });
      setLastTotal(total);
      setPageState('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la entrega');
    }
  }

  function handleNewDelivery() {
    setCart([]);
    setSelectedCustomer('');
    setNotes('');
    setPayStatus('paid');
    setError(null);
    setPageState('building');
  }

  const sel = 'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700';

  // ── Confirmación ──────────────────────────────────────────
  if (pageState === 'confirmed') {
    const customer = customers.find((c) => c.id === selectedCustomer);
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
            payStatus === 'paid' ? 'bg-green-100' : 'bg-amber-100'
          }`}>
            <CheckCircle2 className={`h-9 w-9 ${payStatus === 'paid' ? 'text-green-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Entrega registrada</h2>
            <p className="mt-1 text-sm text-slate-500">
              {customer?.name} · {formatCurrency(lastTotal)}
            </p>
            <p className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
              payStatus === 'paid'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {payStatus === 'paid' ? 'Pagado en el momento' : 'Fiado — pendiente de cobro'}
            </p>
          </div>
          <button onClick={handleNewDelivery}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 text-base font-bold text-white">
            Nueva entrega
          </button>
        </div>
      </div>
    );
  }

  // ── Formulario ────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md pb-32 p-4">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ShoppingBag className="h-6 w-6 text-primary-700" />
          Registrar entrega
        </h1>
      </div>

      <div className="flex flex-col gap-5">
        {/* Viaje */}
        {activeTravelStocks.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Viaje <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <select value={selectedTs} onChange={(e) => handleSelectTs(e.target.value)}
                className={`${sel} pl-10`}>
                <option value="">Sin viaje asignado</option>
                {activeTravelStocks.map((ts) => (
                  <option key={ts.id} value={ts.id}>{ts.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Cliente */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cliente *</label>
          <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}
            className={sel} disabled={customersLoading}>
            <option value="">Seleccioná un cliente…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.locality ? ` — ${c.locality}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Productos del viaje */}
        {selectedTs && tsItems.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Productos del viaje</p>
            {loadingTs ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {tsItems.map((item) => {
                  const remaining = item.quantity_assigned - item.quantity_sold;
                  const inCart = cart.find((c) => c.epId === item.establishment_product_id);
                  return (
                    <button key={item.id} onClick={() => addToCart(item)}
                      disabled={remaining <= 0}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left disabled:opacity-40">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                        <p className="text-xs text-slate-400">
                          Disponible: {remaining} · {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {inCart && (
                          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                            ×{inCart.quantity}
                          </span>
                        )}
                        <Plus className="h-5 w-5 text-primary-700" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Carrito */}
        {cart.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Productos a entregar</p>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {cart.map((item) => (
                <div key={item.epId} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-400">{formatCurrency(item.unitPrice)} c/u</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateCartQty(item.epId ?? '', item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-base font-bold tabular-nums">{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.epId ?? '', item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700 text-white">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-20 text-right text-sm font-semibold tabular-nums">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                  <button onClick={() => setCart((prev) => prev.filter((c) => c.epId !== item.epId))}
                    className="text-slate-300 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            Notas <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones de la entrega…"
            className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:border-primary-700 focus:outline-none" />
        </div>

        {/* Cobro */}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Forma de cobro</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'paid'    as const, label: 'Pagado ahora', color: 'border-green-400 bg-green-50 text-green-700' },
              { value: 'pending' as const, label: 'Fiado',        color: 'border-amber-400 bg-amber-50 text-amber-700' },
            ]).map(({ value, label, color }) => (
              <button key={value} onClick={() => setPayStatus(value)}
                className={`rounded-xl border-2 py-4 text-base font-bold transition-all ${
                  payStatus === value ? color : 'border-slate-200 bg-white text-slate-500'
                }`}>
                {label}
              </button>
            ))}
          </div>
          {payStatus === 'pending' && (
            <p className="mt-2 text-center text-xs text-amber-600">
              Quedará registrado como deuda pendiente en Cobros
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}
      </div>

      {/* Confirmar fijo abajo */}
      {cart.length > 0 && selectedCustomer && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-md">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>{cart.length} productos</span>
              <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
            </div>
            <button onClick={handleConfirm} disabled={isConfirming}
              className={`flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-xl font-black text-white transition-all active:scale-[0.97] disabled:opacity-50 ${
                payStatus === 'paid' ? 'bg-green-600' : 'bg-amber-500'
              }`}>
              {isConfirming
                ? <Loader2 className="h-6 w-6 animate-spin" />
                : payStatus === 'paid' ? 'Confirmar entrega' : 'Registrar fiado'
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
