'use client';

import { format } from 'date-fns';

import { cn } from '@/lib/utils';
import type { DatePreset, DateRange } from '@/hooks/useDashboard';

const PRESETS: { id: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week',  label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
];

interface Props {
  dateRange: DateRange;
  onPreset: (p: Exclude<DatePreset, 'custom'>) => void;
  onCustomRange: (start: Date, end: Date) => void;
}

export function DateFilter({ dateRange, onPreset, onCustomRange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => onPreset(p.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            dateRange.preset === p.id
              ? 'bg-blue-600 text-white shadow-sm'
              : 'border border-slate-300 bg-white text-slate-600 hover:border-slate-400'
          )}
        >
          {p.label}
        </button>
      ))}

      {/* Rango personalizado */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={format(dateRange.start, 'yyyy-MM-dd')}
          onChange={(e) => {
            if (e.target.value) {
              onCustomRange(new Date(e.target.value + 'T00:00:00'), dateRange.end);
            }
          }}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700
                     focus:border-blue-500 focus:outline-none"
        />
        <span className="text-sm text-slate-400">→</span>
        <input
          type="date"
          value={format(dateRange.end, 'yyyy-MM-dd')}
          onChange={(e) => {
            if (e.target.value) {
              onCustomRange(dateRange.start, new Date(e.target.value + 'T23:59:59'));
            }
          }}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700
                     focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
