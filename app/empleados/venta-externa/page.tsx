'use client';

import { useCallback, useState } from 'react';

import { useRouter } from 'next/navigation';

import { AlertTriangle, ArrowLeft, Loader2, Search, ShieldX, ShoppingBag } from 'lucide-react';

import { ExternalItemList } from '@/components/external-sales/ExternalItemList';
import { MobileScanner } from '@/components/external-sales/MobileScanner';
import { PaymentToggle } from '@/components/external-sales/PaymentToggle';
import { ProductSearchSheet } from '@/components/external-sales/ProductSearchSheet';
import { SaleConfirmation } from '@/components/external-sales/SaleConfirmation';
import { useAuth } from '@/hooks/useAuth';
import { useExternalSale } from '@/hooks/useExternalSale';
import type { ConfirmedExternalSaleSummary, EstablishmentProductDetail } from '@/types/database';
import type { ExternalSaleCartItem } from '@/store/externalSale.store';

type PageState = 'building' | 'confirmed';

export default function VentaExternaPage() {
  const router = useRouter();
  const { user, can, loading: authLoading } = useAuth();
  const establishmentId = user?.establishment_id ?? null;

  const {
    items, registerPayment, manualTotal, paymentMethod,
    customerName, notes: _notes, computedTotal, effectiveTotal,
    hasStockWarning, isConfirming, isScanSearching, error,
    addProduct, removeItem, updateQuantity,
    setRegisterPayment, setManualTotal, setPaymentMethod,
    setCustomerName,
    addByBarcode, searchByName, confirmSale, clear,
  } = useExternalSale(establishmentId);

  const [pageState, setPageState] = useState<PageState>('building');
  const [scanStatus, setScanStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');
  const [confirmedData, setConfirmedData] = useState<{
    summary: ConfirmedExternalSaleSummary;
    items: ExternalSaleCartItem[];
    registerPayment: boolean;
    total: number;
    paymentMethod: 'cash' | 'transfer' | null;
    customerName: string;
  } | null>(null);

  // ── Guards ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!can('external_sales.create')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldX className="h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-slate-800">Acceso restringido</h2>
        <p className="text-sm text-slate-500">Solo el dueño puede realizar ventas externas.</p>
        <button
          onClick={() => router.back()}
          className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700"
        >
          Volver
        </button>
      </div>
    );
  }

  // ── Scan handler ──────────────────────────────────────────
  const handleScan = useCallback(async (value: string) => {
    setScanStatus('idle');
    const result = await addByBarcode(value);
    if (result === 'found') {
      setScanStatus('found');
      setTimeout(() => setScanStatus('idle'), 1500);
    } else {
      setScanStatus('not_found');
      setNotFoundBarcode(value);
      setSearchOpen(true);
      setTimeout(() => setScanStatus('idle'), 1500);
    }
  }, [addByBarcode]);

  // ── Confirmar venta ───────────────────────────────────────
  async function handleConfirm() {
    try {
      const snapshot = [...items];
      const summary = await confirmSale();
      setConfirmedData({
        summary,
        items: snapshot,
        registerPayment,
        total: effectiveTotal,
        paymentMethod,
        customerName,
      });
      setPageState('confirmed');
    } catch {
      // error se muestra en el banner
    }
  }

  function handleNewSale() {
    clear();
    setConfirmedData(null);
    setPageState('building');
  }

  // ── Pantalla de confirmación ──────────────────────────────
  if (pageState === 'confirmed' && confirmedData) {
    return (
      <div className="mx-auto max-w-md p-4">
        <SaleConfirmation
          summary={confirmedData.summary}
          items={confirmedData.items}
          registerPayment={confirmedData.registerPayment}
          total={confirmedData.total}
          paymentMethod={confirmedData.paymentMethod}
          customerName={confirmedData.customerName}
          onNewSale={handleNewSale}
        />
      </div>
    );
  }

  // ── Pantalla de construcción de venta ─────────────────────
  const canConfirm =
    items.length > 0 &&
    !hasStockWarning &&
    !isConfirming &&
    (!registerPayment || (paymentMethod !== null && effectiveTotal > 0));

  return (
    <>
      <div className="mx-auto max-w-md pb-32">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-xl p-2 text-slate-500 active:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Venta externa</h1>
              <p className="text-xs text-slate-400">Modo mobile · solo owner</p>
            </div>
            {items.length > 0 && (
              <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-full
                              bg-blue-600 text-xs font-bold text-white">
                {items.length}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5 p-4">
          {/* Scanner */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Agregar producto
            </p>
            <MobileScanner
              onScan={handleScan}
              isSearching={isScanSearching}
              scanStatus={scanStatus}
            />
            <button
              onClick={() => { setNotFoundBarcode(''); setSearchOpen(true); }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl
                         border-2 border-dashed border-slate-200 py-3 text-sm
                         font-medium text-slate-500 active:bg-slate-50"
            >
              <Search className="h-4 w-4" />
              Buscar por nombre
            </button>
          </div>

          {/* Lista de items */}
          {items.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Productos ({items.length})
                </p>
                <button
                  onClick={clear}
                  className="text-xs text-slate-400 active:text-red-500"
                >
                  Limpiar todo
                </button>
              </div>
              <ExternalItemList
                items={items}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            </div>
          )}

          {/* Alerta de stock */}
          {hasStockWarning && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200
                            bg-red-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">
                Uno o más productos superan el stock disponible.
                Ajustá las cantidades antes de confirmar.
              </p>
            </div>
          )}

          {/* Toggle de cobro */}
          {items.length > 0 && (
            <PaymentToggle
              registerPayment={registerPayment}
              onToggle={setRegisterPayment}
              computedTotal={computedTotal}
              manualTotal={manualTotal}
              onManualTotalChange={setManualTotal}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              disabled={isConfirming}
            />
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200
                            bg-red-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Botón CONFIRMAR fijo abajo */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200
                        bg-white/95 backdrop-blur-sm p-4">
          <div className="mx-auto max-w-md">
            {registerPayment && effectiveTotal > 0 && (
              <p className="mb-2 text-center text-sm text-slate-500">
                Total:{' '}
                <span className="font-bold text-slate-900">
                  ${effectiveTotal.toLocaleString('es-AR')}
                </span>
              </p>
            )}
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl
                         bg-green-600 text-xl font-bold text-white transition-all
                         active:scale-[0.97] active:bg-green-500
                         disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isConfirming ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <ShoppingBag className="h-6 w-6" />
                  Confirmar venta
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Bottom sheet de búsqueda */}
      <ProductSearchSheet
        isOpen={searchOpen}
        onClose={() => { setSearchOpen(false); setNotFoundBarcode(''); }}
        onSelect={(p: EstablishmentProductDetail) => addProduct(p)}
        searchFn={searchByName}
        initialQuery={notFoundBarcode}
      />
    </>
  );
}
