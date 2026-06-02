'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { TravelStock, TravelStockItem, EstablishmentProductDetail } from '@/types/database';

export interface TravelStockCartItem {
  product:  EstablishmentProductDetail;
  quantity: number;
}

export function useTravelStocks(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [travelStocks, setTravelStocks] = useState<TravelStock[]>([]);
  const [isLoading, setLoading] = useState(true);

  const fetchTravelStocks = useCallback(async () => {
    if (!establishmentId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('travel_stocks')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false });
    setTravelStocks((data as TravelStock[]) ?? []);
    setLoading(false);
  }, [supabase, establishmentId]);

  useEffect(() => { fetchTravelStocks(); }, [fetchTravelStocks]);

  const fetchItems = useCallback(
    async (travelStockId: string): Promise<TravelStockItem[]> => {
      const { data } = await supabase
        .from('travel_stock_items')
        .select('*')
        .eq('travel_stock_id', travelStockId);
      return (data as TravelStockItem[]) ?? [];
    },
    [supabase]
  );

  const createTravelStock = useCallback(
    async (opts: {
      name: string;
      assignedTo: string | null;
      notes: string;
      items: TravelStockCartItem[];
    }): Promise<string> => {
      if (!establishmentId) throw new Error('No hay establecimiento');

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error('Sesión expirada');

      const { data, error } = await supabase.rpc('confirm_travel_stock', {
        p_establishment_id: establishmentId,
        p_name:             opts.name,
        p_assigned_to:      opts.assignedTo,
        p_notes:            opts.notes || null,
        p_created_by:       userId,
        p_items: opts.items.map((i) => ({
          ep_id:      i.product.id,
          name:       i.product.name,
          quantity:   i.quantity,
          unit_price: i.product.price,
        })),
      });

      if (error) throw new Error(error.message);
      await fetchTravelStocks();
      return (data as { travel_stock_id: string }).travel_stock_id;
    },
    [supabase, establishmentId, fetchTravelStocks]
  );

  const closeTravelStock = useCallback(
    async (travelStockId: string): Promise<void> => {
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase.rpc('close_travel_stock', {
        p_travel_stock_id: travelStockId,
        p_closed_by:       authData.user?.id,
      });
      if (error) throw new Error(error.message);
      setTravelStocks((prev) =>
        prev.map((ts) => ts.id === travelStockId ? { ...ts, status: 'completed' as const } : ts)
      );
    },
    [supabase]
  );

  return {
    travelStocks,
    isLoading,
    createTravelStock,
    closeTravelStock,
    fetchItems,
    refetch: fetchTravelStocks,
  };
}
