'use client';

import { useCallback, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { useCajaStore, type CajaItem } from '@/store/caja.store';
import type { EstablishmentProductDetail, PaymentMethod } from '@/types/database';

export interface SaleTicket {
  saleId: string;
  saleNumber: string;
  subtotal: number;
  discountPct: number;
  total: number;
  amountPaid: number | null;
  changeGiven: number | null;
  paymentMethod: PaymentMethod;
  items: CajaItem[];
}

export function useCaja(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const store = useCajaStore();

  const [isProcessing, setProcessing] = useState(false);
  const [isScanSearching, setScanSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SaleTicket | null>(null);

  // Busca por código de barras y agrega al carrito
  const addByBarcode = useCallback(
    async (barcode: string): Promise<'found' | 'not_found' | 'no_establishment'> => {
      if (!establishmentId) return 'no_establishment';

      setScanSearching(true);
      try {
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
      } catch {
        setScanSearching(false);
        return 'not_found';
      }
    },
    [supabase, establishmentId, store]
  );

  // Búsqueda por nombre (para el modal de productos)
  const searchByName = useCallback(
    async (query: string): Promise<EstablishmentProductDetail[]> => {
      if (!establishmentId || query.trim().length < 2) return [];

      const { data } = await supabase
        .from('establishment_products_detail')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('is_active', true)
        .ilike('name', `%${query.trim()}%`)
        .limit(12);

      return (data as EstablishmentProductDetail[]) ?? [];
    },
    [supabase, establishmentId]
  );

  const processSale = useCallback(async (): Promise<SaleTicket> => {
    if (!establishmentId) throw new Error('No hay establecimiento configurado');
    if (store.items.length === 0) throw new Error('El carrito está vacío');
    if (!store.paymentMethod) throw new Error('Seleccioná un método de pago');

    const total = store.total();

    if (store.paymentMethod === 'cash') {
      if (!store.amountReceived || store.amountReceived < total) {
        throw new Error('El monto recibido es insuficiente');
      }
    }

    setProcessing(true);
    setError(null);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const cashierId = authData.user?.id;
      if (!cashierId) throw new Error('Sesión expirada. Iniciá sesión nuevamente.');

      const rpcItems = store.items.map((item) => ({
        ep_id: item.epId,
        name: item.name,
        barcode: item.barcode,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_pct: item.discount,
      }));

      const { data, error: rpcError } = await supabase.rpc('process_sale', {
        p_establishment_id: establishmentId,
        p_cashier_id: cashierId,
        p_payment_method: store.paymentMethod,
        p_discount_pct: store.globalDiscount,
        p_amount_paid: store.paymentMethod === 'cash' ? store.amountReceived : null,
        p_items: rpcItems,
      });

      if (rpcError) throw new Error(rpcError.message);

      const result = data as {
        sale_id: string;
        sale_number: string;
        subtotal: number;
        discount_pct: number;
        total: number;
        amount_paid: number | null;
        change_given: number | null;
      };

      const newTicket: SaleTicket = {
        saleId: result.sale_id,
        saleNumber: result.sale_number,
        subtotal: result.subtotal,
        discountPct: result.discount_pct,
        total: result.total,
        amountPaid: result.amount_paid,
        changeGiven: result.change_given,
        paymentMethod: store.paymentMethod,
        items: [...store.items],
      };

      setTicket(newTicket);
      store.clear();
      return newTicket;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la venta';
      setError(msg);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [supabase, establishmentId, store]);

  const cancelSale = useCallback(() => {
    store.clear();
    setError(null);
  }, [store]);

  const clearTicket = useCallback(() => setTicket(null), []);

  return {
    // Estado del carrito
    items: store.items,
    paymentMethod: store.paymentMethod,
    globalDiscount: store.globalDiscount,
    amountReceived: store.amountReceived,
    subtotal: store.subtotal(),
    total: store.total(),
    change: store.change(),

    // Estado de operaciones
    isProcessing,
    isScanSearching,
    error,
    ticket,

    // Acciones del carrito (del store)
    addProduct: store.addProduct,
    addFreeItem: store.addFreeItem,
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    updateUnitPrice: store.updateUnitPrice,
    setPaymentMethod: store.setPaymentMethod,
    setGlobalDiscount: store.setGlobalDiscount,
    setAmountReceived: store.setAmountReceived,

    // Acciones de negocio
    addByBarcode,
    searchByName,
    processSale,
    cancelSale,
    clearTicket,
  };
}
