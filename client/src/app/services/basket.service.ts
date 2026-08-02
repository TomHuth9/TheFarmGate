import { effect, Injectable, signal, computed, Injector, inject, PLATFORM_ID, afterNextRender } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../models/product.model';
import { BasketItem } from '../models/basket.model';

const STORAGE_KEY = 'tfg_basket';

@Injectable({ providedIn: 'root' })
export class BasketService {
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);

  // Starts empty so server and client render identically (avoids hydration mismatch).
  // Populated from localStorage after the first client-side render via afterNextRender.
  items = signal<BasketItem[]>([]);

  itemCount = computed(() => this.items().reduce((sum, i) => sum + i.quantity, 0));

  total = computed(() =>
    this.items().reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  );

  constructor() {
    afterNextRender(() => {
      this.items.set(this.load());
      // Set up localStorage persistence only after the initial load to avoid
      // overwriting the stored basket before we've read it.
      effect(
        () => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items())),
        { injector: this.injector }
      );
    });
  }

  private load(): BasketItem[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as BasketItem[]) : [];
    } catch {
      return [];
    }
  }

  add(product: Product, quantity = 1) {
    this.items.update((current) => {
      const existing = current.find((i) => i.product._id === product._id);
      if (existing) {
        return current.map((i) =>
          i.product._id === product._id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...current, { product, quantity }];
    });
  }

  remove(productId: string) {
    this.items.update((current) => current.filter((i) => i.product._id !== productId));
  }

  updateQuantity(productId: string, quantity: number) {
    if (quantity < 1) {
      this.remove(productId);
      return;
    }
    this.items.update((current) =>
      current.map((i) => (i.product._id === productId ? { ...i, quantity } : i))
    );
  }

  clear() {
    this.items.set([]);
  }
}
