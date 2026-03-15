import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CompareProduct {
  id: string;
  slug: string;
  name: string;
  image?: string;
  sku: string;
  price: number;
  b2bPrice?: number;
  specs?: Record<string, any>;
  categoryName?: string;
}

const MAX_COMPARE = 4;

interface CompareStore {
  products: CompareProduct[];
  add: (product: CompareProduct) => boolean;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  isFull: () => boolean;
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      products: [],

      add: (product) => {
        const { products } = get();
        if (products.length >= MAX_COMPARE) return false;
        if (products.some((p) => p.id === product.id)) return true;
        set({ products: [...products, product] });
        return true;
      },

      remove: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      },

      clear: () => set({ products: [] }),

      has: (id) => get().products.some((p) => p.id === id),

      isFull: () => get().products.length >= MAX_COMPARE,
    }),
    {
      name: "compare-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
