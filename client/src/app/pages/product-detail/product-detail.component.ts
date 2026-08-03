import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ProductService } from '../../services/product.service';
import { BasketService } from '../../services/basket.service';
import { ReviewService } from '../../services/review.service';
import { AuthService } from '../../services/auth.service';
import { Product } from '../../models/product.model';
import { Review, ReviewPage } from '../../models/review.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    RouterLink, CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit {
  private productService = inject(ProductService);
  private reviewService  = inject(ReviewService);
  private route = inject(ActivatedRoute);
  basket = inject(BasketService);
  auth   = inject(AuthService);

  product = signal<Product | null>(null);
  quantity = signal(1);
  loading = signal(true);
  added = signal(false);
  relatedProducts = signal<Product[]>([]);
  relatedLoading = signal(false);

  // ── Reviews ────────────────────────────────────────────────────────────────
  reviewPage    = signal<ReviewPage | null>(null);
  reviewsLoading = signal(false);
  submitting    = signal(false);
  reviewError   = signal('');
  reviewSuccess = signal(false);
  hasReviewed   = signal(false);
  pendingRating = signal(0);
  hoverRating   = signal(0);

  reviewForm = new FormGroup({
    rating: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
    body:   new FormControl('', Validators.maxLength(500)),
  });

  canReview = computed(() => this.auth.currentUser()?.role === 'customer');

  basketQty = computed(() => {
    const p = this.product();
    if (!p) return 0;
    return this.basket.items().find((i) => i.product._id === p._id)?.quantity ?? 0;
  });

  // ── Star helpers ───────────────────────────────────────────────────────────

  starsFor(n: number): ('full' | 'half' | 'empty')[] {
    return Array.from({ length: 5 }, (_, i) => {
      const pos = i + 1;
      if (n >= pos) return 'full';
      if (n >= pos - 0.5) return 'half';
      return 'empty';
    });
  }

  starIcon(kind: 'full' | 'half' | 'empty'): string {
    return kind === 'full' ? 'star' : kind === 'half' ? 'star_half' : 'star_border';
  }

  setRating(n: number) {
    this.reviewForm.patchValue({ rating: n });
    this.pendingRating.set(n);
    this.hoverRating.set(0);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.productService.getById(id).subscribe({
      next: (p) => {
        this.product.set(p);
        this.loading.set(false);
        if (p.farm?._id) this.loadRelated(p._id, p.farm._id);
        this.loadReviews(p._id);
      },
      error: () => this.loading.set(false),
    });
  }

  // ── Basket ─────────────────────────────────────────────────────────────────

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

  // ── Related ────────────────────────────────────────────────────────────────

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

  // ── Reviews ────────────────────────────────────────────────────────────────

  private loadReviews(productId: string) {
    this.reviewsLoading.set(true);
    this.reviewService.getForProduct(productId).subscribe({
      next:  (page) => { this.reviewPage.set(page); this.reviewsLoading.set(false); },
      error: ()     => this.reviewsLoading.set(false),
    });
  }

  submitReview() {
    const p = this.product();
    if (!p || this.reviewForm.invalid) return;
    const { rating, body } = this.reviewForm.value;
    if (!rating) return;

    this.submitting.set(true);
    this.reviewError.set('');

    this.reviewService.submit(p._id, rating, body ?? '').subscribe({
      next: (review: Review) => {
        this.submitting.set(false);
        this.reviewSuccess.set(true);
        this.hasReviewed.set(true);
        // Optimistically prepend the new review and recalculate the aggregate
        this.reviewPage.update((rp) => {
          if (!rp) return rp;
          const newCount = rp.count + 1;
          const newAvg   = rp.avgRating === null
            ? rating
            : (rp.avgRating * rp.count + rating) / newCount;
          return { ...rp, reviews: [review, ...rp.reviews], total: rp.total + 1, count: newCount, avgRating: newAvg };
        });
        this.reviewForm.reset();
        this.pendingRating.set(0);
      },
      error: (err) => {
        this.reviewError.set(err.error?.message ?? 'Could not submit review');
        if (err.status === 409) this.hasReviewed.set(true);
        this.submitting.set(false);
      },
    });
  }
}
