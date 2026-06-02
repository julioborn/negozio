'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { Establishment } from '@/types/database';

interface UpdateEstablishmentData {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_id?: string | null;
  logo_url?: string | null;
}

export function useEstablishment(establishmentId: string | null | undefined) {
  const supabase = useMemo(() => createClient(), []);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isUploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!establishmentId) { setLoading(false); return; }
    supabase
      .from('establishments')
      .select('*')
      .eq('id', establishmentId)
      .single()
      .then(({ data }) => {
        setEstablishment(data as Establishment);
        setLoading(false);
      });
  }, [supabase, establishmentId]);

  const updateEstablishment = useCallback(
    async (data: UpdateEstablishmentData) => {
      if (!establishmentId) return;
      setSaving(true);
      setError(null);
      const { error: err } = await supabase
        .from('establishments')
        .update(data)
        .eq('id', establishmentId);
      if (err) {
        setError(err.message);
      } else {
        setEstablishment((prev) => prev ? { ...prev, ...data } : null);
      }
      setSaving(false);
    },
    [supabase, establishmentId]
  );

  const uploadLogo = useCallback(
    async (file: File): Promise<string | null> => {
      if (!establishmentId) return null;
      setUploadingLogo(true);
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${establishmentId}/logo.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('establishment-logos')
        .upload(path, file, { upsert: true });

      if (uploadErr) { setUploadingLogo(false); return null; }

      const { data } = supabase.storage
        .from('establishment-logos')
        .getPublicUrl(path);

      const url = `${data.publicUrl}?t=${Date.now()}`;
      await updateEstablishment({ name: establishment?.name ?? '', logo_url: url });
      setUploadingLogo(false);
      return url;
    },
    [supabase, establishmentId, establishment?.name, updateEstablishment]
  );

  return {
    establishment,
    isLoading,
    isSaving,
    isUploadingLogo,
    error,
    updateEstablishment,
    uploadLogo,
  };
}
