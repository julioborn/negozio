'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Modal } from '@/components/ui/Modal';
import { type SupplierFormData, useSuppliers } from '@/hooks/useSuppliers';
import { cn } from '@/lib/utils';
import type { Supplier } from '@/types/database';

const schema = z.object({
  name:         z.string().min(1, 'El nombre es requerido'),
  contact_name: z.string().optional(),
  phone:        z.string().optional(),
  email:        z.string().email('Email inválido').optional().or(z.literal('')),
  notes:        z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props { establishmentId: string }

export function SuppliersTab({ establishmentId }: Props) {
  const { suppliers, isLoading, createSupplier, updateSupplier, setActive } =
    useSuppliers(establishmentId);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  function openCreate() {
    reset({});
    setEditing(null);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    reset({
      name: s.name,
      contact_name: s.contact_name ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      notes: s.notes ?? '',
    });
    setEditing(s);
    setError(null);
    setModalOpen(true);
  }

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const payload: SupplierFormData = {
        name: data.name,
        contact_name: data.contact_name || null,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
      };
      if (editing) await updateSupplier(editing.id, payload);
      else await createSupplier(payload);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  const inputCls = (err?: string) =>
    cn('block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1',
      err ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''}</p>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Agregar proveedor
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {suppliers.map((s) => (
            <div key={s.id} className={cn(
              'flex items-center gap-4 rounded-xl border bg-white px-4 py-3',
              s.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'
            )}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-400">
                  {[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(s)} title="Editar"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setActive(s.id, !s.is_active)}
                  title={s.is_active ? 'Desactivar' : 'Activar'}
                  className={cn('rounded-lg p-2 transition-colors',
                    s.is_active ? 'text-green-500 hover:bg-red-50 hover:text-red-500'
                                : 'text-slate-400 hover:bg-green-50 hover:text-green-500')}>
                  {s.is_active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                </button>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
              <p className="text-sm text-slate-400">No hay proveedores registrados</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'} size="sm">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {([
            { name: 'name' as const,         label: 'Nombre *' },
            { name: 'contact_name' as const,  label: 'Contacto' },
            { name: 'phone' as const,         label: 'Teléfono' },
            { name: 'email' as const,         label: 'Email' },
            { name: 'notes' as const,         label: 'Notas' },
          ]).map(({ name, label }) => (
            <div key={name} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">{label}</label>
              <input {...register(name)} className={inputCls(errors[name]?.message)} />
              {errors[name] && <p className="text-xs text-red-600">{errors[name]?.message}</p>}
            </div>
          ))}
          <button type="submit" disabled={isSubmitting}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5
                       text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear proveedor'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
