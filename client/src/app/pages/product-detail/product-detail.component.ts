import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { BasketService } from '../../services/basket.service';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit {
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  basket = inject(BasketService);

  product = signal<Product | null>(null);
  quantity = signal(1);
  loading = signal(true);
  added = signal(false);
  relatedProducts = signal<Product[]>([]);
  relatedLoading = signal(false);

  basketQty = computed(() => {
    const p = this.product();
    if (!p) return 0;
    return this.basket.items().find((i) => i.product._id === p._id)?.quantity ?? 0;
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.productService.getById(id).subscribe({
      next: (p) => {
        this.product.set(p);
        this.loading.set(false);
        if (p.farm?._id) {
          this.loadRelated(p._id, p.farm._id);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  addToBasket() {
    const p = this.product();
    if (!p) return;
    this.basket.add(p, this.quantity());
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
  }

  changeQty(delta: number) {
    const max = this.product()?.stock ?? Infinity;
    this.quantity.update((q) => Math.min(max, Math.max(1, q + delta)));
  }

  private loadRelated(currentId: string, farmId: string) {
    this.relatedLoading.set(true);
    this.productService.getAll(undefined, farmId).subscribe({
      next: (products) => {
        this.relatedProducts.set(products.filter((p) => p._id !== currentId).slice(0, 4));
        this.relatedLoading.set(false);
      },
      error: () => this.relatedLoading.set(false),
    });
  }
}
