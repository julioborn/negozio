'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Truck, UserCheck, UserMinus, UserX } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useConfigUsers } from '@/hooks/useConfigUsers';
import { createUserAction } from '@/lib/supabase/user_actions';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types/database';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  cashier:  { label: 'Cajero',   color: 'bg-blue-100 text-blue-700' },
  employee: { label: 'Empleado', color: 'bg-purple-100 text-purple-700' },
};

const addUserSchema = z.object({
  first_name: z.string().min(1, 'Requerido'),
  last_name:  z.string().min(1, 'Requerido'),
  email:      z.string().email('Email inválido'),
  password:   z.string().min(8, 'Mínimo 8 caracteres'),
  role:       z.enum(['cashier', 'employee']),
});
type AddUserData = z.infer<typeof addUserSchema>;

interface Props { establishmentId: string }

export function UsersTab({ establishmentId }: Props) {
  const { users, isLoading, setActive, setTravelMode, refetch } = useConfigUsers(establishmentId);
  const [modalOpen, setModalOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<AddUserData>({ resolver: zodResolver(addUserSchema), defaultValues: { role: 'cashier' } });

  async function handleCreate(data: AddUserData) {
    setServerError(null);
    const full_name = `${data.first_name.trim()} ${data.last_name.trim()}`;
    const result = await createUserAction({ full_name, email: data.email, password: data.password, role: data.role, establishment_id: establishmentId });
    if (!result.success) { setServerError(result.error); return; }
    reset();
    setModalOpen(false);
    refetch();
  }

  const inputCls = (err?: string) =>
    cn('block w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1',
      err ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} usuarios activos en el establecimiento</p>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm
                     font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Agregar usuario
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-400">Cargando…</div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm text-slate-400">No hay empleados ni cajeros registrados</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {['Usuario', 'Rol', 'Estado', 'Modo viaje', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <UserRow key={u.id} user={u} onSetActive={setActive} onSetTravelMode={setTravelMode} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal agregar usuario */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setServerError(null); reset(); }}
        title="Agregar usuario" size="sm">
        {serverError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}
        <form onSubmit={handleSubmit(handleCreate)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <input {...register('first_name')} placeholder="Juan" className={inputCls(errors.first_name?.message)} />
              {errors.first_name && <p className="text-xs text-red-600">{errors.first_name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Apellido</label>
              <input {...register('last_name')} placeholder="García" className={inputCls(errors.last_name?.message)} />
              {errors.last_name && <p className="text-xs text-red-600">{errors.last_name.message}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input {...register('email')} type="email" className={inputCls(errors.email?.message)} />
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Contraseña temporal</label>
            <input {...register('password')} type="password" className={inputCls(errors.password?.message)} />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Rol</label>
            <select {...register('role')} className={inputCls()}>
              <option value="cashier">Cajero</option>
              <option value="employee">Empleado</option>
            </select>
          </div>
          <button type="submit" disabled={isSubmitting}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5
                       text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creando…' : 'Crear usuario'}
          </button>
          {!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost') &&
            !process.env.SUPABASE_SERVICE_ROLE_KEY && (
            <p className="text-center text-xs text-amber-600">
              ⚠ Configurá SUPABASE_SERVICE_ROLE_KEY en .env.local para crear usuarios
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}

interface RowProps {
  user: Profile;
  onSetActive: (id: string, v: boolean) => Promise<boolean>;
  onSetTravelMode: (id: string, v: boolean) => Promise<boolean>;
}

function UserRow({ user, onSetActive, onSetTravelMode }: RowProps) {
  const [loading, setLoading]           = useState(false);
  const [travelLoading, setTravelLoad]  = useState(false);
  const roleInfo = ROLE_LABELS[user.role] ?? { label: user.role, color: 'bg-slate-100 text-slate-700' };

  async function toggle() {
    setLoading(true);
    await onSetActive(user.id, !user.is_active);
    setLoading(false);
  }

  async function toggleTravel(v: boolean) {
    setTravelLoad(true);
    await onSetTravelMode(user.id, v);
    setTravelLoad(false);
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
        <p className="text-xs text-slate-400">{user.email}</p>
      </td>
      <td className="px-4 py-3">
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', roleInfo.color)}>
          {roleInfo.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn('flex items-center gap-1.5 text-xs font-medium',
          user.is_active ? 'text-green-600' : 'text-slate-400')}>
          {user.is_active ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
          {user.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </td>

      {/* Modo viaje — solo para empleados */}
      <td className="px-4 py-3">
        {user.role === 'employee' ? (
          <div className="flex items-center gap-2">
            {travelLoading
              ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              : <Toggle checked={user.travel_mode ?? false} onChange={toggleTravel} size="sm" />
            }
            {(user.travel_mode ?? false) && (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                <Truck className="h-3 w-3" /> Viaje
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <button onClick={toggle} disabled={loading}
          title={user.is_active ? 'Desactivar' : 'Activar'}
          className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            user.is_active
              ? 'border border-red-200 text-red-600 hover:bg-red-50'
              : 'border border-green-200 text-green-600 hover:bg-green-50',
            'disabled:opacity-40'
          )}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
          {user.is_active ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>
  );
}
