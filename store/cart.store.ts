import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { EstablishmentProductDetail } from '@/types/database';

export interface CartItem {
  product: EstablishmentProductDetail;
  quantity: number;
  unit_price: number;
  discount: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: EstablishmentProductDetail, quantity?: number) => void;
  removeItem: (epId: string) => void;
  updateQuantity: (epId: string, quantity: number) => void;
  updateDiscount: (epId: string, discount: number) => void;
  clearCart: () => void;
  subtotal: () => number;
  total: (globalDiscount?: number) => number;
}

export const useCartStore = create<CartState>()(
  devtools(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { product, quantity, unit_price: product.price, discount: 0 },
            ],
          };
        });
      },

      removeItem: (epId) =>
        set((state) => ({
          items: state.items.filter((i) => i.product.id !== epId),
        })),

      updateQuantity: (epId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === epId ? { ...i, quantity: Math.max(1, quantity) } : i
          ),
        })),

      updateDiscount: (epId, discount) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === epId
              ? { ...i, discount: Math.min(100, Math.max(0, discount)) }
              : i
          ),
        })),

      clearCart: () => set({ items: [] }),

      subtotal: () =>
        get().items.reduce((acc, item) => {
          const itemTotal = item.unit_price * item.quantity;
          return acc + itemTotal * (1 - item.discount / 100);
        }, 0),

      total: (globalDiscount = 0) => {
        const subtotal = get().subtotal();
        return subtotal * (1 - globalDiscount / 100);
      },
    }),
    { name: 'CartStore' }
  )
);
