'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { NewProductFormData } from '@/lib/validations/product';
import type { EstablishmentProductDetail } from '@/types/database';

import { useDebounce } from './useDebounce';

const PAGE_SIZE = 20;

export function useProducts(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<EstablishmentProductDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  // Reset a página 0 cuando cambian los filtros
  const prevFiltersRef = useRef({ debouncedSearch, categoryFilter, lowStockOnly });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.debouncedSearch !== debouncedSearch ||
      prev.categoryFilter !== categoryFilter ||
      prev.lowStockOnly !== lowStockOnly
    ) {
      setPage(0);
      prevFiltersRef.current = { debouncedSearch, categoryFilter, lowStockOnly };
    }
  }, [debouncedSearch, categoryFilter, lowStockOnly]);

  const fetch = useCallback(async () => {
    if (!establishmentId) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let query = supabase
      .from('establishment_products_detail')
      .select('*', { count: 'exact' })
      .eq('establishment_id', establishmentId)
      .eq('is_active', true);

    if (debouncedSearch.trim()) {
      const s = debouncedSearch.trim();
      query = query.or(`name.ilike.%${s}%,barcode.ilike.%${s}%,brand.ilike.%${s}%`);
    }
    if (categoryFilter) {
      query = query.eq('category_id', categoryFilter);
    }
    if (lowStockOnly) {
      query = query.eq('is_low_stock', true);
    }

    const from = page * PAGE_SIZE;

    const { data, count, error: qErr } = await query
      .order('name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (qErr) {
      setError(qErr.message);
    } else {
      setItems((data as EstablishmentProductDetail[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [supabase, establishmentId, debouncedSearch, categoryFilter, lowStockOnly, page]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Busca un producto por código de barras dentro del establecimiento
  const searchByBarcode = useCallback(
    async (barcode: string): Promise<EstablishmentProductDetail | null> => {
      if (!establishmentId) return null;
      const { data } = await supabase
        .from('establishment_products_detail')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('barcode', barcode)
        .maybeSingle();
      return (data as EstablishmentProductDetail) ?? null;
    },
    [supabase, establishmentId]
  );

  // Crea un producto en products + establishment_products
  const createProduct = useCallback(
    async (formData: NewProductFormData): Promise<void> => {
      if (!establishmentId) throw new Error('No hay establecimiento configurado');

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      const { data: product, error: pErr } = await supabase
        .from('products')
        .upsert(
          {
            barcode: formData.barcode,
            name: formData.name,
            brand: formData.brand || null,
            category_id: formData.category_id ?? null,
            unit_type: formData.unit_type,
            image_url: formData.image_url ?? null,
            created_by: userId,
          },
          { onConflict: 'barcode', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (pErr || !product) throw new Error(pErr?.message ?? 'Error al guardar el producto');

      const { error: epErr } = await supabase.from('establishment_products').insert({
        establishment_id: establishmentId,
        product_id: product.id,
        price: formData.price,
        cost_price: formData.cost_price ?? null,
        stock: formData.initial_stock ?? 0,
        stock_min_alert: formData.stock_min_alert ?? 5,
      });

      if (epErr) {
        if (epErr.code === '23505') throw new Error('Este producto ya existe en tu establecimiento');
        throw new Error(epErr.message);
      }

      await fetch();
    },
    [supabase, establishmentId, fetch]
  );

  // Actualiza precio con update optimista en UI
  const updatePrice = useCallback(
    async (epId: string, price: number): Promise<void> => {
      const { error: err } = await supabase
        .from('establishment_products')
        .update({ price })
        .eq('id', epId);
      if (err) throw new Error(err.message);
      setItems((prev) => prev.map((item) => (item.id === epId ? { ...item, price } : item)));
    },
    [supabase]
  );

  // Soft-delete (desactiva) un producto del establecimiento
  const deleteProduct = useCallback(
    async (epId: string): Promise<void> => {
      const { error: err } = await supabase
        .from('establishment_products')
        .update({ is_active: false })
        .eq('id', epId);
      if (err) throw new Error(err.message);
      setItems((prev) => prev.filter((item) => item.id !== epId));
      setTotal((t) => t - 1);
    },
    [supabase]
  );

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    setPage,
    isLoading,
    error,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    lowStockOnly,
    setLowStockOnly,
    searchByBarcode,
    createProduct,
    updatePrice,
    deleteProduct,
    refetch: fetch,
  };
}
