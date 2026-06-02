'use client';

import { useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';

import { AlertTriangle, CheckCheck, Loader2, PackagePlus, ShieldX } from 'lucide-react';

import { BarcodeInput } from '@/components/products/BarcodeInput';
import { NewProductModal } from '@/components/stock/NewProductModal';
import { OrderItemList } from '@/components/stock/OrderItemList';
import { OrderSummary } from '@/components/stock/OrderSummary';
import { SupplierSelector } from '@/components/stock/SupplierSelector';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { useSupplierOrder } from '@/hooks/useSupplierOrder';
import { useSuppliers } from '@/hooks/useSuppliers';
import type { ConfirmedOrderSummary, EstablishmentProductDetail, Supplier } from '@/types/database';

export default function IngresoMercaderiaPage() {
  const router = useRouter();
  const { user, can, loading: authLoading } = useAuth();
  const establishmentId = user?.establishment_id ?? null;

  const { suppliers, isLoading: suppliersLoading } = useSuppliers(establishmentId);
  const { searchByBarcode } = useProducts(establishmentId);

  const {
    items, supplierId, setSupplierId,
    addItem, removeItem, updateQuantity, updateUnitCost,
    confirmOrder, reset,
    isConfirming, error, totalUnits,
  } = useSupplierOrder(establishmentId, suppliers);

  const [scanSearching, setScanSearching] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [newProductModalOpen, setNewProductModalOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [confirmedSummary, setConfirmedSummary] = useState<
    (ConfirmedOrderSummary & { supplier: Supplier | null }) | null
  >(null);
  const [itemsSnapshot, setItemsSnapshot] = useState(items);

  // ── Verificación de permiso ───────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!can('stock.create')) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
          <ShieldX className="h-7 w-7 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">Sin permiso</h2>
        <p className="max-w-xs text-sm text-slate-500">
          No tenés permiso para ingresar mercadería. Contactá al administrador.
        </p>
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Volver
        </button>
      </div>
    );
  }

  // ── Scan handler ──────────────────────────────────────────
  const handleScan = useCallback(
    async (barcode: string) => {
      setScanSearching(true);
      setNotFoundBarcode(null);

      const found = await searchByBarcode(barcode);
      setScanSearching(false);

      if (found) {
        addItem(found);
      } else {
        setNotFoundBarcode(barcode);
        setNewProductModalOpen(true);
      }
    },
    [searchByBarcode, addItem]
  );

  // Después de crear un producto nuevo, buscarlo y agregarlo automáticamente
  const handleProductCreated = useCallback(
    async (barcode: string) => {
      setNewProductModalOpen(false);
      setNotFoundBarcode(null);
      setScanSearching(true);
      const found = await searchByBarcode(barcode);
      setScanSearching(false);
      if (found) addItem(found);
    },
    [searchByBarcode, addItem]
  );

  // ── Confirmar ingreso ─────────────────────────────────────
  async function handleConfirm() {
    try {
      setItemsSnapshot([...items]);
      const summary = await confirmOrder();
      setConfirmedSummary(summary);
      setSummaryOpen(true);
    } catch {
      // error ya está en el store
    }
  }

  function handleNewSession() {
    setSummaryOpen(false);
    setConfirmedSummary(null);
    reset();
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <PackagePlus className="h-6 w-6 text-blue-600" />
              Ingreso de mercadería
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Escaneá los productos recibidos para actualizar el stock automáticamente.
            </p>
          </div>
        </div>

        {/* Proveedor */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <SupplierSelector
            suppliers={suppliers}
            value={supplierId}
            onChange={setSupplierId}
            isLoading={suppliersLoading}
            disabled={isConfirming}
          />
        </div>

        {/* Scanner */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Escanear producto
          </p>
          <BarcodeInput
            onDetect={handleScan}
            isSearching={scanSearching}
            disabled={isConfirming}
            placeholder="Código de barras del producto…"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Lista de items */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Items de esta sesión
              {items.length > 0 && (
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {items.length}
                </span>
              )}
            </h2>
            {items.length > 0 && (
              <button
                onClick={reset}
                disabled={isConfirming}
                className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-40"
              >
                Limpiar todo
              </button>
            )}
          </div>

          <OrderItemList
            items={items}
            onUpdateQuantity={updateQuantity}
            onUpdateUnitCost={updateUnitCost}
            onRemove={removeItem}
            disabled={isConfirming}
          />
        </div>

        {/* Confirmar */}
        {items.length > 0 && (
          <div className="sticky bottom-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{items.length}</span>{' '}
                {items.length === 1 ? 'producto' : 'productos'} ·{' '}
                <span className="font-semibold text-slate-900">{totalUnits}</span> unidades
              </div>
              <button
                onClick={handleConfirm}
                disabled={isConfirming || items.length === 0}
                className="
                  flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5
                  text-sm font-semibold text-white shadow-sm
                  hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60
                "
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirmando…
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4" />
                    Confirmar ingreso
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: crear nuevo producto */}
      {notFoundBarcode && establishmentId && (
        <NewProductModal
          isOpen={newProductModalOpen}
          onClose={() => {
            setNewProductModalOpen(false);
            setNotFoundBarcode(null);
          }}
          initialBarcode={notFoundBarcode}
          establishmentId={establishmentId}
          onCreated={handleProductCreated}
        />
      )}

      {/* Modal: resumen del ingreso confirmado */}
      <OrderSummary
        isOpen={summaryOpen}
        summary={confirmedSummary}
        items={itemsSnapshot}
        onNewSession={handleNewSession}
      />
    </>
  );
}
