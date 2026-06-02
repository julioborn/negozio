'use client';

import { useCallback, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { ConfirmedOrderSummary, EstablishmentProductDetail, Supplier } from '@/types/database';

export interface OrderItem {
  product: EstablishmentProductDetail;
  quantity: number;
  unitCost: number | null;
}

interface UseSupplierOrderReturn {
  items: OrderItem[];
  supplierId: string | null;
  setSupplierId: (id: string | null) => void;
  addItem: (product: EstablishmentProductDetail, quantity?: number) => void;
  removeItem: (epId: string) => void;
  updateQuantity: (epId: string, quantity: number) => void;
  updateUnitCost: (epId: string, cost: number | null) => void;
  confirmOrder: (opts?: { notes?: string }) => Promise<ConfirmedOrderSummary & { supplier: Supplier | null }>;
  reset: () => void;
  isConfirming: boolean;
  error: string | null;
  totalUnits: number;
}

export function useSupplierOrder(
  establishmentId: string | null | undefined,
  suppliers: Supplier[]
): UseSupplierOrderReturn {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<OrderItem[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [isConfirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = useCallback((product: EstablishmentProductDetail, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { product, quantity, unitCost: null }];
    });
  }, []);

  const removeItem = useCallback((epId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== epId));
  }, []);

  const updateQuantity = useCallback((epId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((i) => (i.product.id === epId ? { ...i, quantity } : i))
    );
  }, []);

  const updateUnitCost = useCallback((epId: string, cost: number | null) => {
    setItems((prev) =>
      prev.map((i) => (i.product.id === epId ? { ...i, unitCost: cost } : i))
    );
  }, []);

  const confirmOrder = useCallback(
    async (opts?: { notes?: string }) => {
      if (!establishmentId) throw new Error('No hay establecimiento configurado');
      if (items.length === 0) throw new Error('Agregá al menos un producto');

      setConfirming(true);
      setError(null);

      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) throw new Error('Sesión expirada. Iniciá sesión nuevamente.');

        const rpcItems = items.map((i) => ({
          ep_id: i.product.id,
          quantity: i.quantity,
          unit_cost: i.unitCost,
        }));

        const { data, error: rpcError } = await supabase.rpc('confirm_supplier_order', {
          p_establishment_id: establishmentId,
          p_supplier_id: supplierId,
          p_created_by: userId,
          p_notes: opts?.notes ?? null,
          p_items: rpcItems,
        });

        if (rpcError) throw new Error(rpcError.message);

        const summary = data as ConfirmedOrderSummary;
        const supplier = suppliers.find((s) => s.id === supplierId) ?? null;

        return { ...summary, supplier };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error inesperado';
        setError(msg);
        throw err;
      } finally {
        setConfirming(false);
      }
    },
    [supabase, establishmentId, items, supplierId, suppliers]
  );

  const reset = useCallback(() => {
    setItems([]);
    setSupplierId(null);
    setError(null);
  }, []);

  const totalUnits = useMemo(
    () => items.reduce((acc, i) => acc + i.quantity, 0),
    [items]
  );

  return {
    items,
    supplierId,
    setSupplierId,
    addItem,
    removeItem,
    updateQuantity,
    updateUnitCost,
    confirmOrder,
    reset,
    isConfirming,
    error,
    totalUnits,
  };
}
