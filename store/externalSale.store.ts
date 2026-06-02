import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { EstablishmentProductDetail } from '@/types/database';

export interface ExternalSaleCartItem {
  epId: string;
  productId: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  availableStock: number;
  unitPrice: number;
  quantity: number;
}

type ExternalPaymentMethod = 'cash' | 'transfer';

interface ExternalSaleState {
  items: ExternalSaleCartItem[];
  registerPayment: boolean;
  manualTotal: number | null;      // null = usar el calculado
  paymentMethod: ExternalPaymentMethod | null;
  customerName: string;
  notes: string;

  addProduct: (product: EstablishmentProductDetail, qty?: number) => void;
  removeItem: (epId: string) => void;
  updateQuantity: (epId: string, qty: number) => void;
  setRegisterPayment: (v: boolean) => void;
  setManualTotal: (n: number | null) => void;
  setPaymentMethod: (m: ExternalPaymentMethod | null) => void;
  setCustomerName: (n: string) => void;
  setNotes: (n: string) => void;
  clear: () => void;

  computedTotal: () => number;
  effectiveTotal: () => number;
  hasStockWarning: () => boolean;
}

export const useExternalSaleStore = create<ExternalSaleState>()(
  devtools(
    (set, get) => ({
      items: [],
      registerPayment: true,
      manualTotal: null,
      paymentMethod: null,
      customerName: '',
      notes: '',

      addProduct: (product, qty = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.epId === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.epId === product.id ? { ...i, quantity: i.quantity + qty } : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                epId: product.id,
                productId: product.product_id,
                barcode: product.barcode,
                name: product.name,
                brand: product.brand,
                availableStock: product.stock,
                unitPrice: product.price,
                quantity: qty,
              },
            ],
          };
        });
      },

      removeItem: (epId) =>
        set((state) => ({ items: state.items.filter((i) => i.epId !== epId) })),

      updateQuantity: (epId, qty) => {
        if (qty < 1) return;
        set((state) => ({
          items: state.items.map((i) => (i.epId === epId ? { ...i, quantity: qty } : i)),
        }));
      },

      setRegisterPayment: (v) => set({ registerPayment: v, manualTotal: null, paymentMethod: null }),
      setManualTotal: (n) => set({ manualTotal: n }),
      setPaymentMethod: (m) => set({ paymentMethod: m }),
      setCustomerName: (n) => set({ customerName: n }),
      setNotes: (n) => set({ notes: n }),

      clear: () =>
        set({
          items: [],
          registerPayment: true,
          manualTotal: null,
          paymentMethod: null,
          customerName: '',
          notes: '',
        }),

      computedTotal: () =>
        get().items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0),

      effectiveTotal: () => get().manualTotal ?? get().computedTotal(),

      hasStockWarning: () =>
        get().items.some((i) => i.quantity > i.availableStock),
    }),
    { name: 'ExternalSaleStore' }
  )
);
