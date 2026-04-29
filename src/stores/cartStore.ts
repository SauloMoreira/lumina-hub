import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { snapQty, type CartLine } from '@/lib/domain';

type CartState = {
  items: CartLine[];
  isOpen: boolean;
  addItem: (line: Omit<CartLine, 'qty'>, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  incrementQty: (productId: string) => void;
  decrementQty: (productId: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  count: () => number;
  subtotal: () => number;
  hasB2bItems: () => boolean;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      addItem: (line, qty) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === line.productId);
          const min = line.minQty ?? 1;
          const desired = qty ?? min;
          if (existing) {
            const target = snapQty(existing.qty + desired, {
              minQty: existing.minQty ?? line.minQty,
              qtyMultiple: existing.qtyMultiple ?? line.qtyMultiple,
              stock: existing.stock,
            });
            return {
              items: s.items.map((i) =>
                i.productId === line.productId ? { ...i, qty: target } : i
              ),
              isOpen: true,
            };
          }
          const target = snapQty(desired, {
            minQty: line.minQty,
            qtyMultiple: line.qtyMultiple,
            stock: line.stock,
          });
          return {
            items: [...s.items, { ...line, qty: target }],
            isOpen: true,
          };
        }),
      removeItem: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      updateQty: (productId, qty) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId
              ? {
                  ...i,
                  qty: snapQty(qty, {
                    minQty: i.minQty,
                    qtyMultiple: i.qtyMultiple,
                    stock: i.stock,
                  }),
                }
              : i
          ),
        })),
      incrementQty: (productId) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.productId !== productId) return i;
            const step = Math.max(1, i.qtyMultiple ?? 1);
            return {
              ...i,
              qty: snapQty(i.qty + step, {
                minQty: i.minQty,
                qtyMultiple: i.qtyMultiple,
                stock: i.stock,
              }),
            };
          }),
        })),
      decrementQty: (productId) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (i.productId !== productId) return i;
            const step = Math.max(1, i.qtyMultiple ?? 1);
            const min = Math.max(1, i.minQty ?? 1);
            const next = Math.max(min, i.qty - step);
            return {
              ...i,
              qty: snapQty(next, {
                minQty: i.minQty,
                qtyMultiple: i.qtyMultiple,
                stock: i.stock,
              }),
            };
          }),
        })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      count: () => get().items.reduce((acc, i) => acc + i.qty, 0),
      subtotal: () => get().items.reduce((acc, i) => acc + i.price * i.qty, 0),
      hasB2bItems: () => get().items.some((i) => i.source === 'b2b'),
    }),
    { name: 'led-marica-cart', partialize: (s) => ({ items: s.items }) }
  )
);
