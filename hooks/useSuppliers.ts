'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { Supplier } from '@/types/database';

export interface SupplierFormData {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export function useSuppliers(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setLoading] = useState(true);

  const fetchSuppliers = useCallback(async () => {
    if (!establishmentId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('name');
    setSuppliers((data as Supplier[]) ?? []);
    setLoading(false);
  }, [supabase, establishmentId]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const createSupplier = useCallback(
    async (formData: SupplierFormData): Promise<Supplier> => {
      if (!establishmentId) throw new Error('No hay establecimiento');
      const { data, error } = await supabase
        .from('suppliers')
        .insert({ ...formData, establishment_id: establishmentId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const newSupplier = data as Supplier;
      setSuppliers((prev) => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)));
      return newSupplier;
    },
    [supabase, establishmentId]
  );

  const updateSupplier = useCallback(
    async (id: string, formData: SupplierFormData): Promise<void> => {
      const { error } = await supabase
        .from('suppliers')
        .update(formData)
        .eq('id', id);
      if (error) throw new Error(error.message);
      setSuppliers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...formData } : s))
      );
    },
    [supabase]
  );

  const setActive = useCallback(
    async (id: string, is_active: boolean): Promise<void> => {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active })
        .eq('id', id);
      if (error) throw new Error(error.message);
      setSuppliers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active } : s))
      );
    },
    [supabase]
  );

  return {
    suppliers,
    isLoading,
    createSupplier,
    updateSupplier,
    setActive,
    refetch: fetchSuppliers,
  };
}
