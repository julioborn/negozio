'use client';

import { useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlus, Loader2, Save, Store } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useEstablishment } from '@/hooks/useEstablishment';
import { cn } from '@/lib/utils';

const schema = z.object({
  name:    z.string().min(1, 'El nombre es requerido'),
  address: z.string().optional(),
  phone:   z.string().optional(),
  email:   z.string().email('Email inválido').optional().or(z.literal('')),
  tax_id:  z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props { establishmentId: string }

export function BusinessTab({ establishmentId }: Props) {
  const { establishment, isLoading, isSaving, isUploadingLogo, updateEstablishment, uploadLogo } =
    useEstablishment(establishmentId);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      name:    establishment?.name ?? '',
      address: establishment?.address ?? '',
      phone:   establishment?.phone ?? '',
      email:   establishment?.email ?? '',
      tax_id:  establishment?.tax_id ?? '',
    },
  });

  async function onSubmit(data: FormData) {
    await updateEstablishment({
      name:    data.name,
      address: data.address || null,
      phone:   data.phone || null,
      email:   data.email || null,
      tax_id:  data.tax_id || null,
    });
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadLogo(file);
  }

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-slate-400">Cargando…</div>;
  }

  const inputCls = (err?: string) =>
    cn('block w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-1',
      err ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
    );

  return (
    <div className="flex flex-col gap-8 max-w-xl">
      {/* Logo */}
      <div className="flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
          {establishment?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={establishment.logo_url} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Store className="h-8 w-8 text-slate-300" />
            </div>
          )}
          {isUploadingLogo && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          )}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={handleLogoChange} className="hidden" />
          <button onClick={() => fileRef.current?.click()} type="button"
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white
                       px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <ImagePlus className="h-4 w-4" />
            {establishment?.logo_url ? 'Cambiar logo' : 'Subir logo'}
          </button>
          <p className="mt-1 text-xs text-slate-400">JPG, PNG, WebP · máx 2 MB</p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {[
          { name: 'name' as const,    label: 'Nombre del negocio *' },
          { name: 'address' as const, label: 'Dirección' },
          { name: 'phone' as const,   label: 'Teléfono' },
          { name: 'email' as const,   label: 'Email de contacto' },
          { name: 'tax_id' as const,  label: 'CUIT / Razón social' },
        ].map(({ name, label }) => (
          <div key={name} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">{label}</label>
            <input {...register(name)} className={inputCls(errors[name]?.message)} />
            {errors[name] && <p className="text-xs text-red-600">{errors[name]?.message}</p>}
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={isSaving || !isDirty}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm
                       font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
