import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "@/lib/domain";

type CartState = {
  items: CartLine[];
  isOpen: boolean;
  lastSource: "b2b" | "b2c" | null;
  addItem: (line: Omit<CartLine, "qty">, qty?: number, opts?: { openDrawer?: boolean }) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
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
      lastSource: null,
      addItem: (line, qty, opts) =>
        set((s) => {
          const desired = Math.max(1, qty ?? line.minQty ?? 1);
          const openDrawer = opts?.openDrawer ?? true;
          const nextLastSource: "b2b" | "b2c" = line.source === "b2b" ? "b2b" : "b2c";
          const existing = s.items.find((i) => i.productId === line.productId);
          if (existing) {
            const nextQty = Math.min(existing.qty + desired, line.stock || existing.stock);
            return {
              items: s.items.map((i) =>
                i.productId === line.productId
                  ? {
                      ...i,
                      price: line.price,
                      stock: line.stock,
                      image: line.image,
                      freeShippingEligible: line.freeShippingEligible,
                      minQty: line.minQty ?? i.minQty,
                      qtyMultiple: line.qtyMultiple ?? i.qtyMultiple,
                      source: line.source ?? i.source,
                      qty: nextQty,
                    }
                  : i,
              ),
              isOpen: openDrawer ? true : s.isOpen,
              lastSource: nextLastSource,
            };
          }
          return {
            items: [...s.items, { ...line, qty: Math.min(desired, line.stock || desired) }],
            isOpen: openDrawer ? true : s.isOpen,
            lastSource: nextLastSource,
          };
        }),
      removeItem: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      updateQty: (productId, qty) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId
              ? { ...i, qty: Math.max(1, Math.min(qty, i.stock || qty)) }
              : i,
          ),
        })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      count: () => get().items.reduce((acc, i) => acc + i.qty, 0),
      subtotal: () => get().items.reduce((acc, i) => acc + i.price * i.qty, 0),
      hasB2bItems: () => get().items.some((i) => i.source === "b2b"),
    }),
    { name: "led-marica-cart", partialize: (s) => ({ items: s.items, lastSource: s.lastSource }) },
  ),
);

/** Valida regras B2B (mínimo + múltiplo) de uma linha do carrinho. */
export function validateB2bLine(item: CartLine): { ok: true } | { ok: false; reason: string } {
  if (item.source !== "b2b") return { ok: true };
  const min = item.minQty ?? 1;
  const mult = item.qtyMultiple ?? 1;
  if (item.qty < min) {
    return { ok: false, reason: `Quantidade mínima de ${min} un` };
  }
  if (mult > 1) {
    const offset = item.qty - min;
    if (offset % mult !== 0) {
      return { ok: false, reason: `Quantidade deve ser múltipla de ${mult} (a partir de ${min})` };
    }
  }
  return { ok: true };
}
