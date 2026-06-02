'use client';

import { useEffect, useRef, useState } from 'react';

import { Loader2, Package, PlusCircle, X } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { EstablishmentProductDetail } from '@/types/database';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: EstablishmentProductDetail) => void;
  searchFn: (q: string) => Promise<EstablishmentProductDetail[]>;
  initialQuery?: string;
}

export function ProductSearchSheet({ isOpen, onClose, onSelect, searchFn, initialQuery = '' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EstablishmentProductDetail[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setResults([]);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < 2) { setResults([]); return; }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchFn(query);
      setResults(res);
      setSearching(false);
    }, 300);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, searchFn]);

  if (!isOpen) return null;

  return (
    // Bottom sheet mobile
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col
                      rounded-t-3xl bg-white shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-lg font-bold text-slate-900">Buscar producto</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 active:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input de búsqueda */}
        <div className="px-4 pb-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre del producto…"
              className="h-12 w-full rounded-xl border-2 border-slate-200 bg-slate-50 pl-4 pr-10
                         text-base focus:border-blue-500 focus:bg-white focus:outline-none"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            )}
          </div>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              No se encontró &ldquo;{query}&rdquo;
            </p>
          )}

          <div className="flex flex-col gap-2">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); onClose(); }}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white
                           p-3 text-left active:bg-slate-50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center
                                rounded-xl bg-slate-100">
                  <Package className="h-5 w-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-slate-900 truncate">{p.name}</p>
                  <p className="text-sm text-slate-400">
                    {p.brand && <span>{p.brand} · </span>}
                    Stock: <span className={p.stock <= p.stock_min_alert ? 'text-red-500 font-medium' : ''}>{p.stock}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-slate-900">{formatCurrency(p.price)}</p>
                  <PlusCircle className="mt-0.5 ml-auto h-5 w-5 text-blue-500" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
