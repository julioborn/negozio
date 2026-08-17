'use client';

import { useEffect, useMemo, useState } from 'react';

import { AlertCircle, CheckCircle2, Loader2, Package, Plus, Search, X } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';
import type { EstablishmentProductDetail } from '@/types/database';

export default function CargaStockPage() {
  const { user } = useAuth();
  const establishmentId = user?.establishment_id ?? null;
  const supabase = useMemo(() => createClient(), []);

  const [products,    setProducts]    = useState<EstablishmentProductDetail[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [activeEpId,  setActiveEpId]  = useState<string | null>(null);
  const [qty,         setQty]         = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [formError,   setFormError]   = useState<string | null>(null);

  useEffect(() => {
    if (!establishmentId) { setLoading(false); return; }
    supabase
      .from('establishment_products_detail')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setProducts((data as EstablishmentProductDetail[]) ?? []);
        setLoading(false);
      });
  }, [establishmentId, supabase]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.brand    ?? '').toLowerCase().includes(q) ||
      (p.barcode  ?? '').includes(q)
    );
  }, [products, search]);

  function openForm(epId: string) {
    setActiveEpId(epId);
    setQty('');
    setNotes('');
    setFormError(null);
  }

  function closeForm() {
    setActiveEpId(null);
    setQty('');
    setNotes('');
    setFormError(null);
  }

  async function handleConfirm(ep: EstablishmentProductDetail) {
    const amount = parseInt(qty, 10);
    if (isNaN(amount) || amount <= 0) { setFormError('Ingresá una cantidad válida'); return; }
    if (!user) return;

    setSaving(true);
    setFormError(null);

    try {
      const prevStock = ep.stock;
      const newStock  = prevStock + amount;

      const { error: upErr } = await supabase
        .from('establishment_products')
        .update({ stock: newStock })
        .eq('id', ep.id);
      if (upErr) throw new Error(upErr.message);

      await supabase.from('stock_movements').insert({
        establishment_product_id: ep.id,
        type:           'in',
        reason:         'manual',
        quantity:       amount,
        previous_stock: prevStock,
        new_stock:      newStock,
        notes:          notes.trim() || null,
        created_by:     user.id,
      });

      setProducts(prev => prev.map(p => p.id === ep.id ? { ...p, stock: newStock } : p));
      setJustSavedId(ep.id);
      setTimeout(() => setJustSavedId(null), 3000);
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Package className="h-6 w-6 text-primary-700" />
          Carga de stock
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Agregá unidades al stock de cada producto con una descripción opcional.
        </p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, marca o código de barras…"
          className="block w-full rounded-xl border border-slate-200 bg-white
                     py-3 pl-9 pr-10 text-sm focus:border-primary-700 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <Package className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400">
            {products.length === 0 ? 'No hay productos registrados' : 'No se encontraron productos'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(ep => {
            const isActive  = activeEpId === ep.id;
            const justSaved = justSavedId === ep.id;
            const isLow     = ep.stock <= ep.stock_min_alert;

            return (
              <div key={ep.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Fila del producto */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{ep.name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {ep.brand && (
                        <span className="text-xs text-slate-400">{ep.brand}</span>
                      )}
                      <span className={cn(
                        'text-xs font-semibold',
                        isLow ? 'text-red-600' : 'text-slate-500'
                      )}>
                        Stock: {ep.stock} {isLow && '⚠'}
                      </span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{formatCurrency(ep.price)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {justSaved && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    <button
                      onClick={() => isActive ? closeForm() : openForm(ep.id)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                        isActive
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-primary-700 text-white active:bg-primary-800'
                      )}
                    >
                      {isActive ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Formulario inline */}
                {isActive && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="flex flex-col gap-3">

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600">
                          Cantidad a agregar *
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={qty}
                          onChange={e => setQty(e.target.value)}
                          placeholder="Ej: 10"
                          autoFocus
                          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5
                                     text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600">
                          Descripción <span className="font-normal text-slate-400">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="Ej: Recibido de proveedor, ajuste manual…"
                          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5
                                     text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                      </div>

                      {formError && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          {formError}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirm(ep)}
                          disabled={saving || !qty}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg
                                     bg-primary-700 py-2.5 text-sm font-semibold text-white
                                     disabled:opacity-50"
                        >
                          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                          {saving ? 'Guardando…' : 'Confirmar carga'}
                        </button>
                        <button
                          onClick={closeForm}
                          disabled={saving}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5
                                     text-sm font-semibold text-slate-600 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
