'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';

export function useConfigUsers(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!establishmentId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('establishment_id', establishmentId)
      .neq('role', 'owner')
      .order('created_at', { ascending: true });
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, [supabase, establishmentId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const setActive = useCallback(
    async (userId: string, is_active: boolean) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active })
        .eq('id', userId);
      if (!error) setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active } : u)));
      return !error;
    },
    [supabase]
  );

  // Activa/desactiva el modo viaje usando RPC con SECURITY DEFINER
  const setTravelMode = useCallback(
    async (userId: string, travel_mode: boolean) => {
      const { data: ok, error } = await supabase.rpc('set_travel_mode', {
        p_user_id:     userId,
        p_travel_mode: travel_mode,
      });
      if (!error && ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, travel_mode } : u)));
        return true;
      }
      return false;
    },
    [supabase]
  );

  return { users, isLoading, setActive, setTravelMode, refetch: fetchUsers };
}
