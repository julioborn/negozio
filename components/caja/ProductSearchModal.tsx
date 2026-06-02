'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Package, PlusCircle, Search, Tag } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';
import type { EstablishmentProductDetail } from '@/types/database';

type Tab = 'search' | 'free';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: EstablishmentProductDetail) => void;
  onAddFreeItem: (name: string, price: number, quantity: number) => void;
  searchFn: (q: string) => Promise<EstablishmentProductDetail[]>;
  initialQuery?: string;
}

export function ProductSearchModal({
  isOpen, onClose, onAddProduct, onAddFreeItem, searchFn, initialQuery = '',
}: Props) {
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<EstablishmentProductDetail[]>([]);
  const [searching, setSearching] = useState(false);

  // Precio libre
  const [freeName, setFreeName] = useState('');
  const [freePrice, setFreePrice] = useState('');
  const [freeQty, setFreeQty] = useState('1');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) { setQuery(initialQuery); setResults([]); }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < 2) { setResults([]); return; }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchFn(query);
      setResults(res);
      setSearching(false);
    }, 280);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, searchFn]);

  const handleAddProduct = useCallback((p: EstablishmentProductDetail) => {
    onAddProduct(p);
    onClose();
  }, [onAddProduct, onClose]);

  function handleAddFree() {
    const price = parseFloat(freePrice);
    const qty = parseInt(freeQty, 10);
    if (!freeName.trim() || isNaN(price) || price <= 0) return;
    onAddFreeItem(freeName.trim(), price, isNaN(qty) || qty < 1 ? 1 : qty);
    setFreeName(''); setFreePrice(''); setFreeQty('1');
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" title="Agregar producto">
      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {([
          { id: 'search', label: 'Buscar por nombre', icon: Search },
          { id: 'free', label: 'Precio libre', icon: Tag },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors
              ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* TAB: Búsqueda */}
      {tab === 'search' && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre del producto…"
              autoFocus
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm
                         focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
              </div>
            )}
          </div>

          {results.length === 0 && query.trim().length >= 2 && !searching && (
            <p className="py-6 text-center text-sm text-slate-400">
              No se encontraron productos con &ldquo;{query}&rdquo;
            </p>
          )}

          <div className="max-h-72 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => handleAddProduct(p)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5
                           text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center
                                rounded-lg bg-slate-100">
                  <Package className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.brand && <span>{p.brand} · </span>}
                    Stock: {p.stock}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(p.price)}
                  </p>
                </div>
                <PlusCircle className="h-4 w-4 shrink-0 text-blue-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Precio libre */}
      {tab === 'free' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500">
            Para artículos sin código (frutas, verduras, etc.)
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Descripción *</label>
            <input
              type="text"
              value={freeName}
              onChange={(e) => setFreeName(e.target.value)}
              placeholder="Ej: Manzana kg, Servicio reparación…"
              autoFocus={tab === 'free'}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm
                         focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Precio *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={freePrice}
                  onChange={(e) => setFreePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-7 pr-3 text-sm
                             focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Cantidad</label>
              <input
                type="number"
                min="1"
                step="1"
                value={freeQty}
                onChange={(e) => setFreeQty(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm
                           focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleAddFree}
            disabled={!freeName.trim() || !freePrice || parseFloat(freePrice) <= 0}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600
                       py-2.5 text-sm font-semibold text-white hover:bg-blue-700
                       disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            Agregar al carrito
          </button>
        </div>
      )}
    </Modal>
  );
}
