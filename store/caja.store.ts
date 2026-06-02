import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { EstablishmentProductDetail, PaymentMethod } from '@/types/database';

export interface CajaItem {
  id: string;               // UUID temporal para UI
  type: 'product' | 'free';
  epId: string | null;      // establishment_products.id
  productId: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;         // % de descuento por item
}

export function itemSubtotal(item: CajaItem): number {
  return item.unitPrice * item.quantity * (1 - item.discount / 100);
}

interface CajaState {
  items: CajaItem[];
  paymentMethod: PaymentMethod | null;
  globalDiscount: number;   // % descuento global
  amountReceived: number | null;

  addProduct: (product: EstablishmentProductDetail) => void;
  addFreeItem: (name: string, price: number, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  updateUnitPrice: (id: string, price: number) => void;
  updateItemDiscount: (id: string, pct: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setGlobalDiscount: (pct: number) => void;
  setAmountReceived: (amount: number | null) => void;
  clear: () => void;

  subtotal: () => number;
  total: () => number;
  change: () => number | null;
}

export const useCajaStore = create<CajaState>()(
  devtools(
    (set, get) => ({
      items: [],
      paymentMethod: null,
      globalDiscount: 0,
      amountReceived: null,

      addProduct: (product) => {
        set((state) => {
          const existing = state.items.find((i) => i.epId === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.epId === product.id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          const newItem: CajaItem = {
            id: crypto.randomUUID(),
            type: 'product',
            epId: product.id,
            productId: product.product_id,
            barcode: product.barcode,
            name: product.name,
            brand: product.brand,
            quantity: 1,
            unitPrice: product.price,
            discount: 0,
          };
          return { items: [...state.items, newItem] };
        });
      },

      addFreeItem: (name, price, quantity = 1) => {
        set((state) => ({
          items: [
            ...state.items,
            {
              id: crypto.randomUUID(),
              type: 'free',
              epId: null,
              productId: null,
              barcode: null,
              name,
              brand: null,
              quantity,
              unitPrice: price,
              discount: 0,
            },
          ],
        }));
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, qty) => {
        if (qty < 1) return;
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
        }));
      },

      updateUnitPrice: (id, price) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, unitPrice: price } : i)),
        })),

      updateItemDiscount: (id, pct) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, discount: Math.min(100, Math.max(0, pct)) } : i
          ),
        })),

      setPaymentMethod: (method) => set({ paymentMethod: method }),
      setGlobalDiscount: (pct) => set({ globalDiscount: Math.min(100, Math.max(0, pct)) }),
      setAmountReceived: (amount) => set({ amountReceived: amount }),

      clear: () =>
        set({ items: [], paymentMethod: null, globalDiscount: 0, amountReceived: null }),

      subtotal: () => get().items.reduce((acc, i) => acc + itemSubtotal(i), 0),

      total: () => {
        const sub = get().subtotal();
        return sub * (1 - get().globalDiscount / 100);
      },

      change: () => {
        const state = get();
        if (state.paymentMethod !== 'cash' || state.amountReceived == null) return null;
        const diff = state.amountReceived - state.total();
        return diff >= 0 ? diff : null;
      },
    }),
    { name: 'CajaStore' }
  )
);
