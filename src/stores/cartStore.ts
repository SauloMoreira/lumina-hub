import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine } from '@/lib/domain';

type CartState = {
  items: CartLine[];
  isOpen: boolean;
  addItem: (line: Omit<CartLine, 'qty'>, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  count: () => number;
  subtotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      addItem: (line, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === line.productId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === line.productId
                  ? { ...i, qty: Math.min(i.qty + qty, line.stock) }
                  : i
              ),
              isOpen: true,
            };
          }
          return {
            items: [...s.items, { ...line, qty: Math.min(qty, line.stock) }],
            isOpen: true,
          };
        }),
      removeItem: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      updateQty: (productId, qty) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i
          ),
        })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      count: () => get().items.reduce((acc, i) => acc + i.qty, 0),
      subtotal: () => get().items.reduce((acc, i) => acc + i.price * i.qty, 0),
    }),
    { name: 'led-marica-cart', partialize: (s) => ({ items: s.items }) }
  )
);
