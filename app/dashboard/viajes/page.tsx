'use client';

import { useCallback, useMemo, useState } from 'react';

import { AlertTriangle, CheckCheck, Loader2, Minus, Plus, Truck, X } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTravelStocks, type TravelStockCartItem } from '@/hooks/useTravelStocks';
import { formatCurrency } from '@/lib/utils';
import type { EstablishmentProductDetail } from '@/types/database';

export default function ViajesPage() {
  const { user } = useAuth();
  const establishmentId = user?.establishment_id ?? null;
  const supabase = useMemo(() => createClient(), []);

  const { travelStocks, isLoading, createTravelStock, closeTravelStock } =
    useTravelStocks(establishmentId);

  async function searchProducts(q: string): Promise<EstablishmentProductDetail[]> {
    if (!establishmentId || q.trim().length < 2) return [];
    const { data } = await supabase
      .from('establishment_products_detail')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .ilike('name', `%${q.trim()}%`)
      .limit(8);
    return (data as EstablishmentProductDetail[]) ?? [];
  }

  // ── Estado del nuevo viaje ────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TravelStockCartItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<EstablishmentProductDetail[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const results = await searchProducts(q);
    setSearchResults(results);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, establishmentId]);

  function addProduct(p: EstablishmentProductDetail) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === p.id);
      if (existing) return prev.map((i) => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: p, quantity: 1 }];
    });
    setSearch('');
    setSearchResults([]);
  }

  function updateQty(epId: string, qty: number) {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => i.product.id === epId ? { ...i, quantity: qty } : i));
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Ponele un nombre al viaje'); return; }
    if (items.length === 0) { setError('Agregá al menos un producto'); return; }
    setCreating(true);
    setError(null);
    try {
      await createTravelStock({ name: name.trim(), assignedTo: null, notes, items });
      setShowForm(false);
      setName(''); setNotes(''); setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el viaje');
    } finally {
      setCreating(false);
    }
  }

  async function handleClose(id: string) {
    if (!confirm('¿Cerrar este viaje? Los sobrantes vuelven al stock principal.')) return;
    setClosing(id);
    try { await closeTravelStock(id); }
    catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
    finally { setClosing(null); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Truck className="h-6 w-6 text-primary-700" />
            Viajes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Stocks de viaje para distribución en otras localidades
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
            <Plus className="h-4 w-4" /> Nuevo viaje
          </button>
        )}
      </div>

      {/* ── Formulario nuevo viaje ─────────────────────────── */}
      {showForm && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-primary-900">Nuevo viaje</h2>
            <button onClick={() => { setShowForm(false); setError(null); }}
              className="text-primary-600 hover:text-primary-800"><X className="h-5 w-5" /></button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Nombre del viaje *</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Camioneta Juan - 02/06"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-700 focus:outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Notas</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-700 focus:outline-none" />
              </div>
            </div>

            {/* Buscador de productos */}
            <div className="relative">
              <label className="text-sm font-medium text-slate-700">Agregar productos</label>
              <input value={search} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar producto por nombre..."
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-700 focus:outline-none" />
              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                  {searchResults.map((p) => (
                    <button key={p.id} onClick={() => addProduct(p)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-slate-500">Stock: {p.stock} · {formatCurrency(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de items */}
            {items.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Producto','Stock disp.','Cantidad','Subtotal',''].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((item) => (
                      <tr key={item.product.id}>
                        <td className="px-3 py-2.5 text-sm font-medium text-slate-900">{item.product.name}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-500">{item.product.stock}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQty(item.product.id, item.quantity - 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                            <button onClick={() => updateQty(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= item.product.stock}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm font-semibold tabular-nums">
                          {formatCurrency(item.product.price * item.quantity)}
                        </td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => setItems((prev) => prev.filter(i => i.product.id !== item.product.id))}
                            className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && (
              <p className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />{error}
              </p>
            )}

            <button onClick={handleCreate} disabled={creating}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              {creating ? 'Creando viaje…' : 'Crear viaje y descontar stock'}
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de viajes ────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : travelStocks.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <Truck className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400">No hay viajes registrados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {travelStocks.map((ts) => (
            <div key={ts.id}
              className={`flex items-center justify-between rounded-xl border p-4 ${
                ts.status === 'active'
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-slate-200 bg-white opacity-70'
              }`}>
              <div>
                <div className="flex items-center gap-2">
                  <Truck className={`h-4 w-4 ${ts.status === 'active' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <p className="font-semibold text-slate-900">{ts.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    ts.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {ts.status === 'active' ? 'En curso' : 'Completado'}
                  </span>
                </div>
                {ts.notes && <p className="mt-0.5 text-xs text-slate-500">{ts.notes}</p>}
                <p className="mt-0.5 text-xs text-slate-400">
                  {new Date(ts.created_at).toLocaleDateString('es-AR')}
                </p>
              </div>
              {ts.status === 'active' && (
                <button onClick={() => handleClose(ts.id)} disabled={closing === ts.id}
                  className="flex items-center gap-2 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50">
                  {closing === ts.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <CheckCheck className="h-3.5 w-3.5" />
                  }
                  Cerrar viaje
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
