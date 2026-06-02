'use client';

import { useState } from 'react';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Loader2, MapPin, Phone, Receipt } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useDeliveries } from '@/hooks/useDeliveries';
import { formatCurrency } from '@/lib/utils';

export default function CobrosPage() {
  const { user } = useAuth();
  const establishmentId = user?.establishment_id ?? null;
  const { pendingDebts, isLoading, markAsPaid, refetch } = useDeliveries(establishmentId);
  const [marking, setMarking] = useState<string | null>(null);

  async function handleMarkPaid(deliveryId: string) {
    setMarking(deliveryId);
    try { await markAsPaid(deliveryId); }
    catch (err) { alert(err instanceof Error ? err.message : 'Error'); }
    finally { setMarking(null); }
  }

  const totalPending = pendingDebts.reduce((s, d) => s + d.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Receipt className="h-6 w-6 text-primary-700" />
            Cobros pendientes
          </h1>
          <p className="mt-1 text-sm text-slate-500">Fiados y pagos diferidos</p>
        </div>
        {totalPending > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-center">
            <p className="text-xs text-red-600">Total a cobrar</p>
            <p className="text-xl font-black tabular-nums text-red-700">{formatCurrency(totalPending)}</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : pendingDebts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 py-14 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
          <p className="text-sm font-medium text-green-700">No hay cobros pendientes</p>
          <p className="text-xs text-slate-400">Todos los clientes están al día</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pendingDebts.map(({ customer, deliveries, total }) => (
            <div key={customer.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* Header del cliente */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">{customer.name}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {customer.locality && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{customer.locality}
                      </span>
                    )}
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`}
                        className="flex items-center gap-1 hover:text-primary-700">
                        <Phone className="h-3 w-3" />{customer.phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total deuda</p>
                  <p className="text-lg font-black tabular-nums text-red-600">{formatCurrency(total)}</p>
                </div>
              </div>

              {/* Entregas pendientes */}
              <div className="divide-y divide-slate-50">
                {deliveries.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900 tabular-nums">
                        {formatCurrency(d.total_amount)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(d.created_at), "d 'de' MMMM", { locale: es })}
                        {d.notes && ` · ${d.notes}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleMarkPaid(d.id)}
                      disabled={marking === d.id}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5
                                 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {marking === d.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <CheckCircle2 className="h-3.5 w-3.5" />
                      }
                      Cobrado
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
