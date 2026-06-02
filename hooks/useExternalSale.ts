'use client';

import { useCallback, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { useExternalSaleStore } from '@/store/externalSale.store';
import type { ConfirmedExternalSaleSummary, EstablishmentProductDetail } from '@/types/database';

export type { ExternalSaleCartItem } from '@/store/externalSale.store';

export function useExternalSale(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const store = useExternalSaleStore();
  const [isConfirming, setConfirming] = useState(false);
  const [isScanSearching, setScanSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addByBarcode = useCallback(
    async (barcode: string): Promise<'found' | 'not_found'> => {
      if (!establishmentId) return 'not_found';
      setScanSearching(true);
      const { data } = await supabase
        .from('establishment_products_detail')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('barcode', barcode)
        .maybeSingle();
      setScanSearching(false);
      if (data) {
        store.addProduct(data as EstablishmentProductDetail);
        return 'found';
      }
      return 'not_found';
    },
    [supabase, establishmentId, store]
  );

  const searchByName = useCallback(
    async (query: string): Promise<EstablishmentProductDetail[]> => {
      if (!establishmentId || query.trim().length < 2) return [];
      const { data } = await supabase
        .from('establishment_products_detail')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('is_active', true)
        .ilike('name', `%${query.trim()}%`)
        .limit(10);
      return (data as EstablishmentProductDetail[]) ?? [];
    },
    [supabase, establishmentId]
  );

  const confirmSale = useCallback(async (): Promise<ConfirmedExternalSaleSummary> => {
    if (!establishmentId) throw new Error('No hay establecimiento configurado');
    if (store.items.length === 0) throw new Error('Agregá al menos un producto');
    if (store.registerPayment && !store.paymentMethod) {
      throw new Error('Seleccioná un método de cobro');
    }

    setConfirming(true);
    setError(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const sellerId = authData.user?.id;
      if (!sellerId) throw new Error('Sesión expirada. Iniciá sesión nuevamente.');

      const rpcItems = store.items.map((i) => ({
        ep_id: i.epId,
        name: i.name,
        barcode: i.barcode,
        quantity: i.quantity,
        unit_price: store.registerPayment ? i.unitPrice : null,
      }));

      const { data, error: rpcError } = await supabase.rpc('confirm_external_sale', {
        p_establishment_id: establishmentId,
        p_seller_id: sellerId,
        p_register_payment: store.registerPayment,
        p_total: store.registerPayment ? store.effectiveTotal() : null,
        p_payment_method: store.paymentMethod,
        p_customer_name: store.customerName || null,
        p_notes: store.notes || null,
        p_items: rpcItems,
      });

      if (rpcError) throw new Error(rpcError.message);
      return data as ConfirmedExternalSaleSummary;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al confirmar la venta';
      setError(msg);
      throw err;
    } finally {
      setConfirming(false);
    }
  }, [supabase, establishmentId, store]);

  return {
    // Estado
    items: store.items,
    registerPayment: store.registerPayment,
    manualTotal: store.manualTotal,
    paymentMethod: store.paymentMethod,
    customerName: store.customerName,
    notes: store.notes,
    computedTotal: store.computedTotal(),
    effectiveTotal: store.effectiveTotal(),
    hasStockWarning: store.hasStockWarning(),
    isConfirming,
    isScanSearching,
    error,

    // Acciones del store
    addProduct: store.addProduct,
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    setRegisterPayment: store.setRegisterPayment,
    setManualTotal: store.setManualTotal,
    setPaymentMethod: store.setPaymentMethod,
    setCustomerName: store.setCustomerName,
    setNotes: store.setNotes,
    clear: store.clear,

    // Acciones asíncronas
    addByBarcode,
    searchByName,
    confirmSale,
  };
}
