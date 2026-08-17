'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import {
  AlertCircle, CheckCircle2, ChevronDown, Loader2,
  Minus, Package, Plus, X,
} from 'lucide-react';

import { BarcodeInput } from '@/components/products/BarcodeInput';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { createClient } from '@/lib/supabase/client';
import { lookupBarcode } from '@/lib/utils/barcode-lookup';
import { cn, formatCurrency } from '@/lib/utils';
import type { EstablishmentProductDetail } from '@/types/database';

// ─── QtyControl — mismo estilo que el reparto ─────────────────
function QtyControl({
  value, onChange, onConfirm, onCancel,
  confirmLabel, confirmDisabled = false, confirming = false,
  confirmBg = 'bg-primary-700',
}: {
  value:            number;
  onChange:         (updater: (prev: number) => number) => void;
  onConfirm:        () => void;
  onCancel:         () => void;
  confirmLabel:     string;
  confirmDisabled?: boolean;
  confirming?:      boolean;
  confirmBg?:       string;
}) {
  const holdTimer    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  function startHold(delta: number) {
    onChange(prev => Math.max(1, prev + delta));
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(() => {
        onChange(prev => Math.max(1, prev + delta));
      }, 80);
    }, 350);
  }
  function stopHold() {
    if (holdTimer.current)    clearTimeout(holdTimer.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
  }

  return (
    <div className="mt-4 select-none">
      <div className="flex items-center justify-center gap-6">
        <button type="button"
          onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerLeave={stopHold}
          onContextMenu={e => e.preventDefault()}
          className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-slate-700 active:bg-slate-100 select-none">
          <Minus className="h-7 w-7" />
        </button>
        <span className="w-24 text-center text-6xl font-black tabular-nums text-slate-900">{value}</span>
        <button type="button"
          onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerLeave={stopHold}
          onContextMenu={e => e.preventDefault()}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-700 text-white active:bg-primary-800 select-none">
          <Plus className="h-7 w-7" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onConfirm} disabled={confirmDisabled || confirming}
          className={cn('flex-1 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-50', confirmBg)}>
          {confirming
            ? <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            : confirmLabel}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white p-3.5 text-slate-400 hover:text-red-500">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Tipos de estado ──────────────────────────────────────────
type Phase =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'found';     product: EstablishmentProductDetail }
  | { kind: 'not_found'; barcode: string; prefillName: string }
  | { kind: 'saved';     name: string; added: number; newStock: number };

// ─── Page ─────────────────────────────────────────────────────
export default function CargaStockPage() {
  const { user }        = useAuth();
  const establishmentId = user?.establishment_id ?? null;
  const supabase        = useMemo(() => createClient(), []);
  const { searchByBarcode, createProduct } = useProducts(establishmentId);

  const [phase,       setPhase]       = useState<Phase>({ kind: 'idle' });
  const [qty,         setQty]         = useState(1);
  const [notes,       setNotes]       = useState('');
  const [manualName,  setManualName]  = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);

  // historial de la sesión
  const [history,     setHistory]     = useState<{ name: string; added: number }[]>([]);
  const [histOpen,    setHistOpen]    = useState(true);

  // ── Resetear formulario ───────────────────────────────────────
  function reset() {
    setPhase({ kind: 'idle' });
    setQty(1);
    setNotes('');
    setManualName('');
    setManualPrice('');
    setFormError(null);
  }

  // ── Escaneo de código de barras ───────────────────────────────
  const handleScan = useCallback(
    (barcode: string) => {
      void (async () => {
        setPhase({ kind: 'searching' });
        setQty(1); setNotes(''); setManualName(''); setManualPrice(''); setFormError(null);
        try {
          // 1. Buscar en catálogo propio
          const found = await searchByBarcode(barcode);
          if (found) { setPhase({ kind: 'found', product: found }); return; }

          // 2. Intentar pre-llenar nombre desde Open Food/Products Facts
          const ext = await lookupBarcode(barcode);
          setManualName(ext?.name ?? '');
          setPhase({ kind: 'not_found', barcode, prefillName: ext?.name ?? '' });
        } catch {
          setPhase({ kind: 'idle' });
        }
      })();
    },
    [searchByBarcode]
  );

  // ── Confirmar carga de stock (producto ya existente) ──────────
  async function handleConfirmFound() {
    if (phase.kind !== 'found') return;
    if (!user) return;
    setSaving(true); setFormError(null);
    try {
      const ep       = phase.product;
      const prevStock = ep.stock;
      const newStock  = prevStock + qty;

      const { error: upErr } = await supabase
        .from('establishment_products')
        .update({ stock: newStock })
        .eq('id', ep.id);
      if (upErr) throw new Error(upErr.message);

      await supabase.from('stock_movements').insert({
        establishment_product_id: ep.id,
        type:           'in',
        reason:         'manual',
        quantity:       qty,
        previous_stock: prevStock,
        new_stock:      newStock,
        notes:          notes.trim() || null,
        created_by:     user.id,
      });

      setHistory(h => [{ name: ep.name, added: qty }, ...h]);
      setPhase({ kind: 'saved', name: ep.name, added: qty, newStock });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // ── Crear producto nuevo y cargar stock ───────────────────────
  async function handleConfirmNew() {
    if (phase.kind !== 'not_found') return;
    if (!manualName.trim()) { setFormError('Ingresá el nombre del producto'); return; }
    const price = parseFloat(manualPrice.replace(',', '.'));
    if (isNaN(price) || price <= 0) { setFormError('Ingresá un precio válido'); return; }
    if (!user) return;

    setSaving(true); setFormError(null);
    try {
      await createProduct({
        barcode:       phase.barcode,
        name:          manualName.trim(),
        brand:         null,
        category_id:   null,
        unit_type:     'unit',
        net_content:   null,
        image_url:     null,
        price,
        cost_price:    null,
        initial_stock: qty,
        stock_min_alert: 5,
      });

      // Registrar movimiento de stock para el producto recién creado
      const ep = await searchByBarcode(phase.barcode);
      if (ep && user) {
        await supabase.from('stock_movements').insert({
          establishment_product_id: ep.id,
          type:           'in',
          reason:         'manual',
          quantity:       qty,
          previous_stock: 0,
          new_stock:      qty,
          notes:          notes.trim() || null,
          created_by:     user.id,
        });
      }

      setHistory(h => [{ name: manualName.trim(), added: qty }, ...h]);
      setPhase({ kind: 'saved', name: manualName.trim(), added: qty, newStock: qty });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el producto');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-xl">

      {/* Header */}
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Package className="h-6 w-6 text-primary-700" />
          Carga de stock
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Escaneá el código de barras para cargar o registrar un producto.
        </p>
      </div>

      {/* Scanner */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <BarcodeInput
          onDetect={handleScan}
          isSearching={phase.kind === 'searching'}
          disabled={saving}
          placeholder="Escaneá con la pistola lectora…"
        />
      </div>

      {/* Buscando */}
      {phase.kind === 'searching' && (
        <div className="mb-4 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-8 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Buscando producto…</span>
        </div>
      )}

      {/* Producto encontrado en catálogo */}
      {phase.kind === 'found' && (
        <div className="mb-4 rounded-2xl border-2 border-primary-200 bg-primary-50 p-4">

          {/* Info */}
          <div className="mb-4 flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-primary-900">{phase.product.name}</p>
              {phase.product.brand && (
                <p className="text-xs text-primary-600">{phase.product.brand}</p>
              )}
              <p className="mt-0.5 text-xs text-primary-700">
                Stock actual: <strong>{phase.product.stock}</strong>
                {' · '}
                {formatCurrency(phase.product.price)}
              </p>
            </div>
          </div>

          {/* Descripción opcional */}
          <div className="mb-1">
            <label className="text-xs text-primary-700">Descripción (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Recibido de proveedor, ajuste…"
              className="mt-0.5 block w-full rounded-xl border border-primary-200 bg-white px-3 py-2.5
                         text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>

          {/* Error */}
          {formError && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />{formError}
            </div>
          )}

          <QtyControl
            value={qty}
            onChange={setQty}
            onConfirm={handleConfirmFound}
            onCancel={reset}
            confirmLabel={`Cargar (${qty})`}
            confirming={saving}
          />
        </div>
      )}

      {/* Producto NO encontrado — ingresar manualmente */}
      {phase.kind === 'not_found' && (
        <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-600">
            No encontrado — ingresar manualmente
          </p>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-amber-700">Código de barras</label>
              <input readOnly value={phase.barcode}
                className="mt-0.5 block w-full rounded-xl border border-amber-200 bg-white/70 px-3 py-2
                           text-sm font-mono text-slate-600 select-all" />
            </div>
            <div>
              <label className="text-xs text-amber-700">Nombre del producto</label>
              <input
                type="text"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Ej: Lavandina 1L"
                autoFocus
                className="mt-0.5 block w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5
                           text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="text-xs text-amber-700">Precio de venta ($)</label>
              <input
                type="text"
                inputMode="decimal"
                value={manualPrice}
                onChange={e => {
                  const v = e.target.value.replace(',', '.');
                  if (/^\d*\.?\d*$/.test(v)) setManualPrice(v);
                }}
                placeholder="0.00"
                className="mt-0.5 block w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5
                           text-base font-semibold focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="text-xs text-amber-700">Descripción (opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ej: Ingreso inicial de mercadería…"
                className="mt-0.5 block w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5
                           text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
          </div>

          {formError && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />{formError}
            </div>
          )}

          <QtyControl
            value={qty}
            onChange={setQty}
            onConfirm={handleConfirmNew}
            onCancel={reset}
            confirmLabel={`Crear y cargar (${qty})`}
            confirmDisabled={!manualName.trim() || !manualPrice}
            confirming={saving}
            confirmBg="bg-amber-600"
          />
        </div>
      )}

      {/* Guardado con éxito */}
      {phase.kind === 'saved' && (
        <div className="mb-4 rounded-2xl border-2 border-green-200 bg-green-50 p-4">
          <div className="mb-4 flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="text-sm font-bold text-green-900">Stock cargado</p>
              <p className="mt-0.5 text-xs text-green-700">
                <strong>{phase.added}</strong> unidades agregadas a <strong>{phase.name}</strong>.
                Stock nuevo: <strong>{phase.newStock}</strong>.
              </p>
            </div>
          </div>
          <button onClick={reset}
            className="w-full rounded-xl border border-green-300 bg-white py-3 text-sm font-bold text-green-700 hover:bg-green-50 active:bg-green-100">
            Escanear otro producto
          </button>
        </div>
      )}

      {/* Historial de la sesión */}
      {history.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setHistOpen(o => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200
                       bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <div className="flex items-center gap-2">
              <span>Cargados esta sesión</span>
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full
                               bg-primary-700 px-1.5 text-[11px] font-bold text-white">
                {history.length}
              </span>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform duration-200',
              histOpen ? 'rotate-180' : '')} />
          </button>
          {histOpen && (
            <div className="mt-2 flex flex-col gap-1.5">
              {history.map((item, i) => (
                <div key={i}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                  <p className="text-sm font-medium text-slate-800">{item.name}</p>
                  <span className="text-xs font-semibold text-primary-700">+{item.added}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
