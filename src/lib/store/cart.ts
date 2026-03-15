import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartItem {
  id: string; // ProductVariant ID
  productId: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
  maxStock: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updatePrice: (id: string, price: number) => void;
  setItems: (items: CartItem[]) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const currentItems = get().items;
        const existingItem = currentItems.find((i) => i.id === item.id);

        if (existingItem) {
          const newQuantity = Math.min(
            existingItem.quantity + item.quantity,
            existingItem.maxStock
          );
          set({
            items: currentItems.map((i) =>
              i.id === item.id ? { ...i, quantity: newQuantity } : i
            ),
          });
        } else {
          set({ items: [...currentItems, item] });
        }
      },
      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
      },
      updateQuantity: (id, quantity) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id
              ? { ...i, quantity: Math.min(Math.max(1, quantity), i.maxStock) }
              : i
          ),
        }));
      },
      updatePrice: (id, price) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, price } : i)),
        }));
      },
      setItems: (items) => set({ items }),
      clearCart: () => set({ items: [] }),
      getTotalItems: () =>
        get().items.reduce((acc, item) => acc + item.quantity, 0),
      getTotalPrice: () =>
        get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    }),
    {
      name: "shopping-cart-storage",
      storage: createJSONStorage(() => localStorage),
      skipHydration: false,
      version: 1,
    }
  )
);
