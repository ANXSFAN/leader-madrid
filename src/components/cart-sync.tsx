"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useCallback, useState } from "react";
import { useCartStore, CartItem } from "@/lib/store/cart";
import { syncCartWithServer, saveCartToServer } from "@/lib/actions/cart";
import { useDebounce } from "@/hooks/use-debounce";

export function CartSync() {
  const { data: session } = useSession();
  const { items, setItems } = useCartStore();
  const isSyncing = useRef(false);
  const initialized = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const debouncedItems = useDebounce(items, 500);

  const runInitialSync = useCallback(async () => {
    if (
      session?.user?.id &&
      !initialized.current &&
      !isSyncing.current
    ) {
      isSyncing.current = true;
      initialized.current = true;
      try {
        const serverItems = await syncCartWithServer(
          items.map((i) => ({ id: i.id, quantity: i.quantity }))
        );

        if (serverItems) {
          setItems(serverItems as CartItem[]);
        }
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to sync cart:", error);
        initialized.current = false;
      } finally {
        isSyncing.current = false;
      }
    }
  }, [session, items, setItems]);

  useEffect(() => {
    if (session?.user) {
      runInitialSync();
    }
  }, [session, runInitialSync]);

  useEffect(() => {
    const saveToServer = async () => {
      if (session?.user?.id && isInitialized) {
        try {
          await saveCartToServer(
            debouncedItems.map((i) => ({ id: i.id, quantity: i.quantity }))
          );
        } catch (error) {
          console.error("Failed to save cart to server:", error);
        }
      }
    };

    if (isInitialized) {
      saveToServer();
    }
  }, [debouncedItems, session, isInitialized]);

  return null;
}
