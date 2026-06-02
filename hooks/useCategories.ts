'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { ProductCategory } from '@/types/database';

export interface CategoryFormData {
  name: string;
  color: string;
  description?: string | null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    .slice(0, 60);
}

export function useCategories() {
  const supabase = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('product_categories')
      .select('*')
      .order('name');
    setCategories((data as ProductCategory[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const createCategory = useCallback(
    async (formData: CategoryFormData): Promise<ProductCategory> => {
      const slug = slugify(formData.name);
      const { data, error } = await supabase
        .from('product_categories')
        .insert({ ...formData, slug })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const cat = data as ProductCategory;
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      return cat;
    },
    [supabase]
  );

  const updateCategory = useCallback(
    async (id: string, formData: CategoryFormData): Promise<void> => {
      const { error } = await supabase
        .from('product_categories')
        .update(formData)
        .eq('id', id);
      if (error) throw new Error(error.message);
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...formData } : c))
      );
    },
    [supabase]
  );

  return {
    categories,
    isLoading,
    createCategory,
    updateCategory,
    refetch: fetchCategories,
  };
}
