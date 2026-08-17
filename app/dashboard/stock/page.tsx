'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  AlertCircle, CheckCircle2, Loader2, Package, RotateCcw,
} from 'lucide-react';

import { BarcodeInput } from '@/components/products/BarcodeInput';
import { NewProductModal } from '@/components/stock/NewProductModal';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';
import type { EstablishmentProductDetail } from '@/types/database';

type State =
  | { phase: 'idle' }
  | { phase: 'searching' }
  | { phase: 'found'; product: EstablishmentProductDetail }
  | { phase: 'saved'; product: EstablishmentProductDetail; added: number }
  | { phase: 'not_found'; barcode: string };

export default function CargaStockPage() {
  const { user } = useAuth();
  const establishmentId = user?.establishment_id ?? null;
  const supabase = useMemo(() => createClient(), []);
  const { searchByBarcode } = useProducts(establishmentId);

  const [state,      setState]      = useState<State>({ phase: 'idle' });
  const [qty,        setQty]        = useState('');
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);

  // ── Escaneo ───────────────────────────────────────────────
  const handleScan = useCallback(
    (barcode: string) => {
      void (async () => {
        setState({ phase: 'searching' });
        setQty('');
        setNotes('');
        setFormError(null);
        try {
          const found = await searchByBarcode(barcode);
          if (found) {
            setState({ phase: 'found', product: found });
          } else {
            setState({ phase: 'not_found', barcode });
            setModalOpen(true);
          }
        } catch {
          setState({ phase: 'idle' });
        }
      })();
    },
    [searchByBarcode]
  );

  // ── Después de crear un producto nuevo ────────────────────
  const handleProductCreated = useCallback(
    (barcode: string) => {
      setModalOpen(false);
      void (async () => {
        setState({ phase: 'searching' });
        try {
          const found = await searchByBarcode(barcode);
          if (found) setState({ phase: 'found', product: found });
          else        setState({ phase: 'idle' });
        } catch {
          setState({ phase: 'idle' });
        }
      })();
    },
    [searchByBarcode]
  );

  // ── Confirmar carga de stock ──────────────────────────────
  async function handleConfirm() {
    if (state.phase !== 'found') return;
    const amount = parseInt(qty, 10);
    if (isNaN(amount) || amount <= 0) { setFormError('Ingresá una cantidad válida'); return; }
    if (!user) return;

    setSaving(true);
    setFormError(null);

    try {
      const ep       = state.product;
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

      setState({ phase: 'saved', product: { ...ep, stock: newStock }, added: amount });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setState({ phase: 'idle' });
    setQty('');
    setNotes('');
    setFormError(null);
  }

  // ── Render ────────────────────────────────────────────────
  const notFoundBarcode = state.phase === 'not_found' ? state.barcode : null;

  return (
    <>
      <div className="mx-auto flex max-w-xl flex-col gap-6">

        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Package className="h-6 w-6 text-primary-700" />
            Carga de stock
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Escaneá el código de barras de un producto para cargar o crear stock.
          </p>
        </div>

        {/* Scanner */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Escanear producto
          </p>
          <BarcodeInput
            onDetect={handleScan}
            isSearching={state.phase === 'searching'}
            disabled={saving}
            placeholder="Código de barras del producto…"
          />
        </div>

        {/* Estado: buscando */}
        {state.phase === 'searching' && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-8 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <span className="text-sm text-slate-500">Buscando producto…</span>
          </div>
        )}

        {/* Estado: producto encontrado — formulario de carga */}
        {state.phase === 'found' && (
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

            {/* Info del producto */}
            <div className="flex items-start gap-3 rounded-lg bg-primary-50 px-4 py-3">
              <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary-900">{state.product.name}</p>
                {state.product.brand && (
                  <p className="text-xs text-primary-600">{state.product.brand}</p>
                )}
                <div className="mt-1 flex items-center gap-3 text-xs text-primary-700">
                  <span>Stock actual: <strong>{state.product.stock}</strong></span>
                  <span>·</span>
                  <span>{formatCurrency(state.product.price)}</span>
                </div>
              </div>
            </div>

            {/* Cantidad */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Cantidad a agregar *</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={qty}
                onChange={e => setQty(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleConfirm(); }}
                placeholder="Ej: 10"
                autoFocus
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5
                           text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            {/* Descripción */}
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

            {/* Error */}
            {formError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {formError}
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={saving || !qty}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg
                           bg-primary-700 py-2.5 text-sm font-semibold text-white
                           disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Guardando…' : 'Confirmar carga'}
              </button>
              <button
                onClick={reset}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white
                           px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Estado: guardado con éxito */}
        {state.phase === 'saved' && (
          <div className="flex flex-col gap-4 rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-900">Stock cargado</p>
                <p className="mt-0.5 text-xs text-green-700">
                  Se agregaron <strong>{state.added}</strong> unidades a{' '}
                  <strong>{state.product.name}</strong>.
                  Stock nuevo: <strong>{state.product.stock}</strong>.
                </p>
              </div>
            </div>
            <button
              onClick={reset}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg',
                'border border-green-300 bg-white py-2.5 text-sm font-semibold text-green-700',
                'hover:bg-green-50 active:bg-green-100'
              )}
            >
              <RotateCcw className="h-4 w-4" />
              Escanear otro producto
            </button>
          </div>
        )}
      </div>

      {/* Modal: crear nuevo producto */}
      {notFoundBarcode && establishmentId && (
        <NewProductModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setState({ phase: 'idle' }); }}
          initialBarcode={notFoundBarcode}
          establishmentId={establishmentId}
          onCreated={handleProductCreated}
        />
      )}
    </>
  );
}
