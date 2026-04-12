import { Injectable, signal, computed } from '@angular/core';
import { Product } from '../models/product.model';
import { BasketItem } from '../models/basket.model';

@Injectable({ providedIn: 'root' })
export class BasketService {
  items = signal<BasketItem[]>([]);

  // Total item count for the basket icon badge
  itemCount = computed(() => this.items().reduce((sum, i) => sum + i.quantity, 0));

  // Grand total price
  total = computed(() =>
    this.items().reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  );

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
