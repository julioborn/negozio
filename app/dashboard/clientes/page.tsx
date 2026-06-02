'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, Pencil, Phone, Plus, UserCheck, UserX, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useCustomers, type CustomerFormData } from '@/hooks/useCustomers';
import { formatCurrency, cn } from '@/lib/utils';
import type { Customer } from '@/types/database';

const schema = z.object({
  name:     z.string().min(1, 'El nombre es requerido'),
  phone:    z.string().optional(),
  locality: z.string().optional(),
  notes:    z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function ClientesPage() {
  const { user } = useAuth();
  const establishmentId = user?.establishment_id ?? null;
  const { customers, isLoading, createCustomer, updateCustomer, setActive } =
    useCustomers(establishmentId);

  const [editing, setEditing] = useState<Customer | null>(null);
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

  function openEdit(c: Customer) {
    reset({ name: c.name, phone: c.phone ?? '', locality: c.locality ?? '', notes: c.notes ?? '' });
    setEditing(c);
    setError(null);
    setModalOpen(true);
  }

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const payload: CustomerFormData = {
        name: data.name,
        phone: data.phone || null,
        locality: data.locality || null,
        notes: data.notes || null,
      };
      if (editing) await updateCustomer(editing.id, payload);
      else await createCustomer(payload);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  const inp = (err?: boolean) =>
    cn('block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1',
      err ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:border-primary-700 focus:ring-primary-700'
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Users className="h-6 w-6 text-primary-700" />
            Clientes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Directorio de clientes del establecimiento
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
          <Plus className="h-4 w-4" /> Nuevo cliente
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <Users className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400">Todavía no hay clientes registrados</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <div key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{c.name}</p>
                  {c.locality && (
                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3" />{c.locality}
                    </p>
                  )}
                  {c.phone && (
                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      <Phone className="h-3 w-3" />{c.phone}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setActive(c.id, !c.is_active)}
                    className={cn('rounded-lg p-1.5 transition-colors',
                      c.is_active ? 'text-green-500 hover:bg-red-50 hover:text-red-500'
                                  : 'text-slate-400 hover:bg-green-50 hover:text-green-500')}>
                    {c.is_active ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {c.total_debt > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-1.5">
                  <span className="text-xs font-medium text-red-700">Deuda pendiente</span>
                  <span className="text-sm font-bold text-red-700 tabular-nums">
                    {formatCurrency(c.total_debt)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'} size="sm">
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {([
            { name: 'name' as const,     label: 'Nombre *',    ph: 'Juan Pérez' },
            { name: 'locality' as const, label: 'Localidad',   ph: 'Villa Mercedes' },
            { name: 'phone' as const,    label: 'Teléfono',    ph: '2664 123456' },
            { name: 'notes' as const,    label: 'Notas',       ph: 'Observaciones...' },
          ]).map(({ name, label, ph }) => (
            <div key={name} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">{label}</label>
              <input {...register(name)} placeholder={ph} className={inp(!!errors[name])} />
              {errors[name] && <p className="text-xs text-red-600">{errors[name]?.message}</p>}
            </div>
          ))}
          <button type="submit" disabled={isSubmitting}
            className="flex items-center justify-center rounded-lg bg-primary-700 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">
            {isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
