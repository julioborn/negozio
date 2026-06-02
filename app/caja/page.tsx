'use client';

import { useCallback, useState } from 'react';

import { Loader2, ShieldX } from 'lucide-react';

import { CajaItemList } from '@/components/caja/CajaItemList';
import { CajaScanner } from '@/components/caja/CajaScanner';
import { PaymentPanel } from '@/components/caja/PaymentPanel';
import { ProductSearchModal } from '@/components/caja/ProductSearchModal';
import { TicketModal } from '@/components/caja/TicketModal';
import { useAuth } from '@/hooks/useAuth';
import { useCaja } from '@/hooks/useCaja';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';
import type { EstablishmentProductDetail } from '@/types/database';

type ScanStatus = 'idle' | 'searching' | 'found' | 'not_found';

export default function CajaPage() {
  const { user, can, loading: authLoading, establishment } = useAuth();
  const { cajaIsDark } = useThemeStore();
  const establishmentId = user?.establishment_id ?? null;

  const {
    items, subtotal, total, change,
    paymentMethod, amountReceived, globalDiscount,
    isProcessing, isScanSearching, error, ticket,
    addProduct, addFreeItem,
    removeItem, updateQuantity, updateUnitPrice,
    setPaymentMethod, setGlobalDiscount, setAmountReceived,
    addByBarcode, searchByName, processSale, cancelSale, clearTicket,
  } = useCaja(establishmentId);

  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');

  // ── Clases por tema ───────────────────────────────────────
  const d = cajaIsDark;
  const border  = d ? 'border-gray-800'   : 'border-slate-200';
  const panelBg = d ? 'bg-gray-950'       : 'bg-white';
  const btnCls  = d
    ? 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700';

  const handleScan = useCallback(async (value: string) => {
    setScanStatus('searching');
    const result = await addByBarcode(value);
    if (result === 'found') {
      setScanStatus('found');
      setTimeout(() => setScanStatus('idle'), 800);
    } else if (result === 'not_found') {
      setScanStatus('not_found');
      setNotFoundBarcode(value);
      setSearchOpen(true);
      setTimeout(() => setScanStatus('idle'), 1200);
    }
  }, [addByBarcode]);

  const handleCancelSale = useCallback(() => {
    if (items.length === 0) return;
    if (window.confirm('¿Cancelar la venta actual? Se perderán los items cargados.')) {
      cancelSale();
    }
  }, [items.length, cancelSale]);

  async function handleConfirm() {
    try { await processSale(); } catch { /* error en PaymentPanel */ }
  }

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className={cn('h-8 w-8 animate-spin', d ? 'text-gray-600' : 'text-slate-400')} />
      </div>
    );
  }

  if (!can('sales.create')) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <ShieldX className="h-12 w-12 text-red-400" />
        <h2 className={cn('text-lg font-semibold', d ? 'text-gray-300' : 'text-slate-700')}>
          Sin permiso para operar la caja
        </h2>
        <p className={d ? 'text-sm text-gray-600' : 'text-sm text-slate-400'}>Contactá al administrador.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full">

        {/* ═══ PANEL IZQUIERDO (60%) ════════════════════════════ */}
        <div className={cn('flex w-[60%] flex-col border-r', border, panelBg)}>

          {/* Indicador de estado */}
          <div className={cn('flex items-center justify-between border-b px-4 py-2', border)}>
            <span className={cn('text-sm font-semibold', d ? 'text-gray-400' : 'text-slate-600')}>
              {establishment?.name ?? 'Caja'}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className={cn('text-xs', d ? 'text-gray-600' : 'text-slate-400')}>En línea</span>
            </div>
          </div>

          {/* Scanner */}
          <div className={cn('border-b px-4 py-3', border)}>
            <CajaScanner
              onScan={handleScan}
              isSearching={isScanSearching}
              scanStatus={scanStatus}
              isDark={d}
            />
          </div>

          {/* Lista de items */}
          <CajaItemList
            items={items}
            onUpdateQuantity={updateQuantity}
            onUpdateUnitPrice={updateUnitPrice}
            onRemove={removeItem}
            isDark={d}
          />

          {/* Barra inferior */}
          <div className={cn('flex items-center gap-2 border-t px-4 py-2.5', border)}>
            {['+ Agregar sin código', 'Buscar por nombre'].map((label) => (
              <button
                key={label}
                onClick={() => { setNotFoundBarcode(''); setSearchOpen(true); }}
                className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors', btnCls)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ PANEL DERECHO (40%) ══════════════════════════════ */}
        <div className="flex w-[40%] flex-col">
          <PaymentPanel
            subtotal={subtotal}
            total={total}
            globalDiscount={globalDiscount}
            paymentMethod={paymentMethod}
            amountReceived={amountReceived}
            change={change}
            itemCount={items.length}
            isProcessing={isProcessing}
            error={error}
            onSetPaymentMethod={setPaymentMethod}
            onSetDiscount={setGlobalDiscount}
            onSetAmountReceived={setAmountReceived}
            onConfirm={handleConfirm}
            onCancel={handleCancelSale}
            isDark={d}
          />
        </div>
      </div>

      <ProductSearchModal
        isOpen={searchOpen}
        onClose={() => { setSearchOpen(false); setNotFoundBarcode(''); }}
        onAddProduct={(p: EstablishmentProductDetail) => { addProduct(p); setSearchOpen(false); }}
        onAddFreeItem={(name, price, qty) => { addFreeItem(name, price, qty); setSearchOpen(false); }}
        searchFn={searchByName}
        initialQuery={notFoundBarcode}
      />

      <TicketModal ticket={ticket} onClose={clearTicket} />
    </>
  );
}
