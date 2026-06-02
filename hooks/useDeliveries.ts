'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { Customer, Delivery, TravelStockItem } from '@/types/database';

export interface DeliveryCartItem {
  epId:       string | null;
  name:       string;
  quantity:   number;
  unitPrice:  number;
}

export interface PendingDebt {
  customer:   Customer;
  deliveries: Delivery[];
  total:      number;
}

export function useDeliveries(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [pendingDebts, setPendingDebts] = useState<PendingDebt[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isConfirming, setConfirming] = useState(false);

  const fetchPendingDebts = useCallback(async () => {
    if (!establishmentId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('deliveries')
      .select('*, customer:customers(*)')
      .eq('establishment_id', establishmentId)
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false });

    // Agrupar por cliente
    const map = new Map<string, { customer: Customer; deliveries: Delivery[] }>();
    for (const d of (data ?? []) as (Delivery & { customer: Customer })[]) {
      const key = d.customer_id;
      if (!map.has(key)) map.set(key, { customer: d.customer, deliveries: [] });
      map.get(key)!.deliveries.push(d);
    }

    setPendingDebts(
      Array.from(map.values()).map(({ customer, deliveries }) => ({
        customer,
        deliveries,
        total: deliveries.reduce((s, d) => s + Number(d.total_amount), 0),
      }))
    );
    setLoading(false);
  }, [supabase, establishmentId]);

  useEffect(() => { fetchPendingDebts(); }, [fetchPendingDebts]);

  const createDelivery = useCallback(
    async (opts: {
      travelStockId: string | null;
      customerId:    string;
      paymentStatus: 'paid' | 'pending';
      notes:         string;
      items:         DeliveryCartItem[];
    }): Promise<string> => {
      if (!establishmentId) throw new Error('No hay establecimiento');

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error('Sesión expirada');

      setConfirming(true);
      try {
        const { data, error } = await supabase.rpc('create_delivery', {
          p_establishment_id: establishmentId,
          p_travel_stock_id:  opts.travelStockId,
          p_customer_id:      opts.customerId,
          p_sold_by:          userId,
          p_payment_status:   opts.paymentStatus,
          p_notes:            opts.notes || null,
          p_items: opts.items.map((i) => ({
            ep_id:      i.epId,
            name:       i.name,
            quantity:   i.quantity,
            unit_price: i.unitPrice,
          })),
        });
        if (error) throw new Error(error.message);
        if (opts.paymentStatus === 'pending') fetchPendingDebts();
        return (data as { delivery_id: string }).delivery_id;
      } finally {
        setConfirming(false);
      }
    },
    [supabase, establishmentId, fetchPendingDebts]
  );

  const markAsPaid = useCallback(
    async (deliveryId: string): Promise<void> => {
      const { error } = await supabase.rpc('mark_delivery_paid', {
        p_delivery_id: deliveryId,
      });
      if (error) throw new Error(error.message);
      await fetchPendingDebts();
    },
    [supabase, fetchPendingDebts]
  );

  return {
    pendingDebts,
    isLoading,
    isConfirming,
    createDelivery,
    markAsPaid,
    refetch: fetchPendingDebts,
  };
}
