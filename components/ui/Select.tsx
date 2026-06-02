'use client';

import { useEffect, useRef, useState } from 'react';

import { Check, ChevronDown, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options:      SelectOption[];
  value:        string | null;
  onChange:     (v: string | null) => void;
  placeholder?: string;
  searchable?:  boolean;
  clearable?:   boolean;
  label?:       string;
  error?:       string;
  hint?:        string;
  disabled?:    boolean;
  className?:   string;
  required?:    boolean;
}

export function Select({
  options, value, onChange,
  placeholder = 'Seleccioná una opción',
  searchable, clearable, label, error, hint, disabled, className, required,
}: SelectProps) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const containerRef          = useRef<HTMLDivElement>(null);
  const searchRef             = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = searchable && search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Foco en búsqueda al abrir
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 20);
    }
  }, [open, searchable]);

  function select(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setSearch('');
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-danger-500">*</span>}
        </label>
      )}

      <div ref={containerRef} className="relative">
        {/* Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
            'disabled:cursor-not-allowed disabled:bg-slate-50',
            error
              ? 'border-danger-400 focus:ring-danger-400'
              : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500',
            open && 'border-primary-500 ring-2 ring-primary-500 ring-offset-1'
          )}
        >
          <span className={cn(selected ? 'text-slate-900' : 'text-slate-400')}>
            {selected?.label ?? placeholder}
          </span>
          <div className="flex items-center gap-1">
            {clearable && selected && (
              <span
                onClick={clear}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown
              className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')}
            />
          </div>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
            {searchable && (
              <div className="border-b border-slate-100 p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar…"
                    className="w-full rounded-lg bg-slate-50 py-1.5 pl-8 pr-3 text-xs
                               focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
              </div>
            )}

            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-center text-xs text-slate-400">
                  No se encontraron opciones
                </p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => select(opt)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-sm transition-colors',
                      opt.disabled
                        ? 'cursor-not-allowed text-slate-300'
                        : 'text-slate-700 hover:bg-primary-50 hover:text-primary-700',
                      value === opt.value && 'bg-primary-50 font-medium text-primary-700'
                    )}
                  >
                    {opt.label}
                    {value === opt.value && <Check className="h-3.5 w-3.5 text-primary-600" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger-600">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
