'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarRange } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DatePreset, DateRange } from '@/hooks/useDashboard';

const PRESETS: { id: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week',  label: 'Semana' },
  { id: 'month', label: 'Mes' },
];

interface Props {
  dateRange:      DateRange;
  onPreset:       (p: Exclude<DatePreset, 'custom'>) => void;
  onCustomRange:  (start: Date, end: Date) => void;
}

export function DateFilter({ dateRange, onPreset, onCustomRange }: Props) {
  const startStr = format(dateRange.start, 'yyyy-MM-dd');
  const endStr   = format(dateRange.end,   'yyyy-MM-dd');

  // Etiqueta del rango actual
  const rangeLabel = dateRange.preset === 'custom'
    ? `${format(dateRange.start, 'd MMM', { locale: es })} – ${format(dateRange.end, 'd MMM yyyy', { locale: es })}`
    : PRESETS.find((p) => p.id === dateRange.preset)?.label ?? '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Presets */}
      <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => onPreset(p.id)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all',
              dateRange.preset === p.id
                ? 'bg-primary-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Selector de rango estilo hotel — desde / hasta en un bloque */}
      <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-r border-slate-200 px-3 py-2">
          <CalendarRange className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Desde</span>
            <input
              type="date"
              value={startStr}
              max={endStr}
              onChange={(e) => {
                if (e.target.value)
                  onCustomRange(new Date(e.target.value + 'T00:00:00'), dateRange.end);
              }}
              className="w-32 cursor-pointer border-none bg-transparent text-sm font-medium text-slate-900 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hasta</span>
            <input
              type="date"
              value={endStr}
              min={startStr}
              onChange={(e) => {
                if (e.target.value)
                  onCustomRange(dateRange.start, new Date(e.target.value + 'T23:59:59'));
              }}
              className="w-32 cursor-pointer border-none bg-transparent text-sm font-medium text-slate-900 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
