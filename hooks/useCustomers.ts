'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { Customer } from '@/types/database';

export interface CustomerFormData {
  name:      string;
  phone?:    string | null;
  locality?: string | null;
  barrio?:   string | null;
  notes?:    string | null;
}

export function useCustomers(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    if (!establishmentId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('is_active', true)
      .order('name');
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  }, [supabase, establishmentId]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const createCustomer = useCallback(
    async (formData: CustomerFormData): Promise<Customer> => {
      if (!establishmentId) throw new Error('No hay establecimiento');
      const { data, error } = await supabase
        .from('customers')
        .insert({ ...formData, establishment_id: establishmentId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const c = data as Customer;
      setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
      return c;
    },
    [supabase, establishmentId]
  );

  const updateCustomer = useCallback(
    async (id: string, formData: CustomerFormData): Promise<void> => {
      const { error } = await supabase.from('customers').update(formData).eq('id', id);
      if (error) throw new Error(error.message);
      setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...formData } : c)));
    },
    [supabase]
  );

  const setActive = useCallback(
    async (id: string, is_active: boolean): Promise<void> => {
      await supabase.from('customers').update({ is_active }).eq('id', id);
      setCustomers((prev) => prev.filter((c) => (is_active ? true : c.id !== id)));
    },
    [supabase]
  );

  const deleteCustomer = useCallback(
    async (id: string): Promise<void> => {
      // Borrar delivery_items → deliveries → customer en cascada
      const { data: dels } = await supabase.from('deliveries').select('id').eq('customer_id', id);
      const delIds = (dels ?? []).map((d: { id: string }) => d.id);
      if (delIds.length > 0) {
        await supabase.from('delivery_items').delete().in('delivery_id', delIds);
        await supabase.from('deliveries').delete().in('id', delIds);
      }
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw new Error(error.message);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    },
    [supabase]
  );

  return { customers, isLoading, createCustomer, updateCustomer, setActive, deleteCustomer, refetch: fetchCustomers };
}
