'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Boxes, Loader2, Settings, Shield, Store, Truck, Users } from 'lucide-react';

import { BusinessTab }     from '@/components/config/tabs/BusinessTab';
import { CategoriesTab }   from '@/components/config/tabs/CategoriesTab';
import { PermissionsTab }  from '@/components/config/tabs/PermissionsTab';
import { SuppliersTab }    from '@/components/config/tabs/SuppliersTab';
import { UsersTab }        from '@/components/config/tabs/UsersTab';
import { useAuth }         from '@/hooks/useAuth';
import { cn }              from '@/lib/utils';

type TabId = 'negocio' | 'usuarios' | 'permisos' | 'proveedores' | 'categorias';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'negocio',     label: 'Negocio',     icon: Store },
  { id: 'usuarios',    label: 'Usuarios',    icon: Users },
  { id: 'permisos',    label: 'Permisos',    icon: Shield },
  { id: 'proveedores', label: 'Proveedores', icon: Truck },
  { id: 'categorias',  label: 'Categorías',  icon: Boxes },
];

export default function ConfiguracionPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('negocio');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  if (user?.role !== 'owner') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <Shield className="h-10 w-10 text-red-400" />
        <h2 className="text-lg font-semibold text-slate-800">Solo el dueño puede acceder a esta sección</h2>
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">Volver</button>
      </div>
    );
  }

  const establishmentId = user.establishment_id ?? '';

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <Settings className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
          <p className="text-sm text-slate-500">Administración del establecimiento</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium',
              'border-b-2 transition-colors',
              activeTab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido del tab */}
      <div className="min-h-[400px]">
        {activeTab === 'negocio'     && <BusinessTab    establishmentId={establishmentId} />}
        {activeTab === 'usuarios'    && <UsersTab       establishmentId={establishmentId} />}
        {activeTab === 'permisos'    && <PermissionsTab />}
        {activeTab === 'proveedores' && <SuppliersTab   establishmentId={establishmentId} />}
        {activeTab === 'categorias'  && <CategoriesTab />}
      </div>
    </div>
  );
}
