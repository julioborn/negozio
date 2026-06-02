'use client';

import { useEffect, useRef, useState } from 'react';

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DatePreset, DateRange } from '@/hooks/useDashboard';

const PRESETS: { id: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week',  label: 'Semana' },
  { id: 'month', label: 'Mes' },
];

const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getCalendarDays(month: Date): Date[] {
  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

interface Props {
  dateRange:     DateRange;
  onPreset:      (p: Exclude<DatePreset, 'custom'>) => void;
  onCustomRange: (start: Date, end: Date) => void;
}

export function DateFilter({ dateRange, onPreset, onCustomRange }: Props) {
  const [isOpen,      setIsOpen]      = useState(false);
  const [viewMonth,   setViewMonth]   = useState(new Date());
  const [tempStart,   setTempStart]   = useState<Date | null>(null);
  const [hoverDate,   setHoverDate]   = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setTempStart(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleDayClick(day: Date) {
    if (!tempStart) {
      // Primer clic → desde
      setTempStart(day);
    } else {
      // Segundo clic → hasta
      const [start, end] = isAfter(day, tempStart)
        ? [tempStart, day]
        : [day, tempStart];

      const startFull = new Date(start); startFull.setHours(0, 0, 0, 0);
      const endFull   = new Date(end);   endFull.setHours(23, 59, 59, 999);

      onCustomRange(startFull, endFull);
      setTempStart(null);
      setIsOpen(false);
    }
  }

  // Rango a resaltar (real o preview con hover)
  const previewEnd = tempStart && hoverDate ? hoverDate : null;
  const rangeStart = tempStart ?? dateRange.start;
  const rangeEnd   = previewEnd ?? dateRange.end;
  const [displayStart, displayEnd] = isAfter(rangeEnd, rangeStart)
    ? [rangeStart, rangeEnd]
    : [rangeEnd, rangeStart];

  function isDayStart(d: Date)  { return isSameDay(d, displayStart); }
  function isDayEnd(d: Date)    { return isSameDay(d, displayEnd); }
  function isDayInRange(d: Date) {
    return isWithinInterval(d, { start: displayStart, end: displayEnd });
  }

  const days = getCalendarDays(viewMonth);

  // Etiqueta del botón
  const buttonLabel = (() => {
    const s = dateRange.start;
    const e = dateRange.end;
    if (isSameDay(s, e)) return format(s, 'd MMM yyyy', { locale: es });
    return `${format(s, 'd MMM', { locale: es })} → ${format(e, 'd MMM yyyy', { locale: es })}`;
  })();

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center gap-2">

      {/* Presets */}
      <div className="flex items-center rounded-xl bg-white/15 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => { onPreset(p.id); setTempStart(null); setIsOpen(false); }}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all',
              dateRange.preset === p.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-white/80 hover:bg-white/20'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Botón que abre el picker */}
      <button
        onClick={() => { setIsOpen((v) => !v); setViewMonth(dateRange.start); }}
        className={cn(
          'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all',
          isOpen
            ? 'bg-white text-primary-700 shadow-sm'
            : 'bg-white/15 text-white hover:bg-white/25'
        )}
      >
        <CalendarRange className="h-4 w-4 shrink-0" />
        <span>{buttonLabel}</span>
        {tempStart && (
          <span className="text-xs opacity-75">
            → elegí el hasta
          </span>
        )}
      </button>

      {/* ── Calendario desplegable ─────────────────────── */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl
                        border border-slate-200 bg-white shadow-2xl">

          {/* Navegación del mes */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <button
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-bold capitalize text-slate-900">
              {format(viewMonth, 'MMMM yyyy', { locale: es })}
            </p>
            <button
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Hint */}
          <div className="bg-primary-50 px-4 py-2 text-center text-xs font-medium text-primary-700">
            {tempStart
              ? `Desde: ${format(tempStart, 'd MMM', { locale: es })} — ahora elegí el hasta`
              : 'Tocá el día de inicio'}
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 border-b border-slate-100 px-2 pt-3 pb-1">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400">{d}</div>
            ))}
          </div>

          {/* Grid de días */}
          <div className="grid grid-cols-7 gap-0 px-2 py-2">
            {days.map((day, i) => {
              const inMonth  = isSameMonth(day, viewMonth);
              const isStart  = isDayStart(day);
              const isEnd    = isDayEnd(day);
              const inRange  = isDayInRange(day);
              const isToday  = isSameDay(day, new Date());
              const isSel    = isStart || isEnd;

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(day)}
                  onMouseEnter={() => tempStart && setHoverDate(day)}
                  onMouseLeave={() => setHoverDate(null)}
                  className={cn(
                    'relative flex h-9 w-full items-center justify-center text-sm transition-colors',
                    !inMonth && 'text-slate-300',
                    inMonth && !isSel && !inRange && 'text-slate-700 hover:bg-primary-50 hover:text-primary-700',
                    inRange && !isSel && 'bg-primary-100 text-primary-800',
                    isSel && 'bg-primary-700 font-bold text-white',
                    isStart && 'rounded-l-full',
                    isEnd && 'rounded-r-full',
                    isSel && 'rounded-full z-10',
                    isToday && !isSel && 'font-bold underline decoration-primary-400',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Footer con el rango seleccionado */}
          {!tempStart && (
            <div className="border-t border-slate-100 px-4 py-3 text-center">
              <p className="text-xs text-slate-500">
                {format(dateRange.start, "d 'de' MMM", { locale: es })}
                {' '}→{' '}
                {format(dateRange.end, "d 'de' MMM yyyy", { locale: es })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
