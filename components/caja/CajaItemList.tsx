'use client';

import { useRef, useState } from 'react';

import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';

import { itemSubtotal, type CajaItem } from '@/store/caja.store';
import { formatCurrency } from '@/lib/utils';

interface Props {
  items: CajaItem[];
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateUnitPrice: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  isDark?: boolean;
}

export function CajaItemList({ items, onUpdateQuantity, onUpdateUnitPrice, onRemove, isDark = true }: Props) {
  const t = isDark
    ? { cart: 'text-gray-800', cartLabel: 'text-gray-700', cartSub: 'text-gray-800',
        thead: 'bg-gray-950', th: 'text-slate-500', row: 'hover:bg-gray-900/60',
        divider: 'divide-gray-900', name: 'text-white', brand: 'text-gray-600', mono: 'text-gray-700',
        qty: 'text-white', qtyBtn: 'border-gray-800 text-gray-700 hover:bg-gray-800 hover:text-gray-300',
        price: 'text-gray-400 hover:text-white', subtotal: 'text-white', del: 'text-gray-800 hover:bg-red-950 hover:text-red-400',
        input: 'bg-gray-800 text-white', priceInput: 'bg-gray-800 text-white border-gray-700',
      }
    : { cart: 'text-slate-300', cartLabel: 'text-slate-500', cartSub: 'text-slate-400',
        thead: 'bg-slate-50', th: 'text-slate-500', row: 'hover:bg-slate-50',
        divider: 'divide-slate-100', name: 'text-slate-900', brand: 'text-slate-400', mono: 'text-slate-400',
        qty: 'text-slate-900', qtyBtn: 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        price: 'text-slate-500 hover:text-slate-900', subtotal: 'text-slate-900', del: 'text-slate-300 hover:bg-red-50 hover:text-red-500',
        input: 'bg-white text-slate-900 border-slate-200', priceInput: 'bg-white text-slate-900 border-slate-300',
      };

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <ShoppingCart className="h-12 w-12 text-gray-800" />
        <p className="text-base font-medium text-gray-700">Carrito vacío</p>
        <p className="text-sm text-gray-800">Escaneá un producto para empezar</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full">
        <thead className={`sticky top-0 z-10 ${t.thead}`}>
          <tr className={`border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
            {['Producto','Cantidad','Precio','Subtotal'].map((h, i) => (
              <th key={h} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${t.th} ${i===0?'text-left':i===1?'text-center':'text-right'} ${i===1?'w-32':i>=2?'w-28':''}`}>
                {h}
              </th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className={`divide-y ${t.divider}`}>
          {items.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              index={index + 1}
              onUpdateQuantity={onUpdateQuantity}
              onUpdateUnitPrice={onUpdateUnitPrice}
              onRemove={onRemove}
              t={t}
              isDark={isDark}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Fila de item ─────────────────────────────────────────────
interface RowProps {
  item: CajaItem;
  index: number;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateUnitPrice: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: Record<string, string>;
  isDark: boolean;
}

function ItemRow({ item, index, onUpdateQuantity, onUpdateUnitPrice, onRemove, t, isDark }: RowProps) {
  const [editingQty, setEditingQty] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(item.quantity));
  const [priceInput, setPriceInput] = useState(String(item.unitPrice));
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  function commitQty() {
    const n = parseInt(qtyInput, 10);
    if (!isNaN(n) && n >= 1) onUpdateQuantity(item.id, n);
    else setQtyInput(String(item.quantity));
    setEditingQty(false);
  }

  function commitPrice() {
    const n = parseFloat(priceInput);
    if (!isNaN(n) && n > 0) onUpdateUnitPrice(item.id, n);
    else setPriceInput(String(item.unitPrice));
    setEditingPrice(false);
  }

  return (
    <tr className={`group transition-colors ${t.row}`}>
      {/* Nombre */}
      <td className="px-3 py-3">
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold ${isDark ? 'bg-gray-800 text-gray-500' : 'bg-slate-100 text-slate-400'}`}>
            {index}
          </span>
          <div>
            <p className={`text-sm font-semibold leading-tight ${t.name}`}>{item.name}</p>
            {item.brand && <p className={`text-xs ${t.brand}`}>{item.brand}</p>}
            {item.barcode && <p className={`font-mono text-xs ${t.mono}`}>{item.barcode}</p>}
          </div>
        </div>
      </td>

      {/* Cantidad */}
      <td className="px-3 py-3">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.qtyBtn}`}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>

          {editingQty ? (
            <input
              ref={qtyRef}
              type="number"
              min={1}
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              onBlur={commitQty}
              onKeyDown={(e) => { if (e.key === 'Enter') commitQty(); if (e.key === 'Escape') setEditingQty(false); }}
              autoFocus
              className={`w-14 rounded py-0.5 text-center text-base font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 ${t.input}`}
            />
          ) : (
            <button
              onClick={() => { setQtyInput(String(item.quantity)); setEditingQty(true); }}
              className={`min-w-[2.5rem] rounded px-2 py-0.5 text-center text-base font-bold ${t.qty} ${isDark ? 'hover:bg-gray-800' : 'hover:bg-slate-100'}`}
              title="Clic para editar cantidad"
            >
              {item.quantity}
            </button>
          )}

          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.qtyBtn}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>

      {/* Precio unitario */}
      <td className="px-3 py-3 text-right">
        {editingPrice ? (
          <input
            ref={priceRef}
            type="number"
            step="0.01"
            min="0.01"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => { if (e.key === 'Enter') commitPrice(); if (e.key === 'Escape') setEditingPrice(false); }}
            autoFocus
            className={`w-24 rounded py-0.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${t.priceInput}`}
          />
        ) : (
          <button
            onClick={() => { setPriceInput(String(item.unitPrice)); setEditingPrice(true); }}
            className={`text-sm ${t.price}`}
            title="Clic para editar precio"
          >
            {formatCurrency(item.unitPrice)}
          </button>
        )}
      </td>

      {/* Subtotal */}
      <td className="px-3 py-3 text-right">
        <span className={`text-sm font-semibold tabular-nums ${t.subtotal}`}>
          {formatCurrency(itemSubtotal(item))}
        </span>
      </td>

      {/* Eliminar */}
      <td className="px-2 py-3">
        <button
          onClick={() => onRemove(item.id)}
          className={`rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100 ${t.del}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
