import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { BasketService } from '../../services/basket.service';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [
    RouterLink, CurrencyPipe,
    MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './browse.component.html',
  styleUrl: './browse.component.scss',
})
export class BrowseComponent implements OnInit {
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  basket = inject(BasketService);

  products = signal<Product[]>([]);
  loading = signal(true);
  activeCategory = signal<string>('');

  readonly categories = ['All', 'Dairy', 'Beef', 'Pork', 'Vegetables', 'Eggs', 'Poultry'];

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const cat = params.get('category') ?? '';
      this.activeCategory.set(cat);
      this.loadProducts(cat);
    });
  }

  selectCategory(cat: string) {
    if (cat === 'All') {
      this.router.navigate(['/browse']);
    } else {
      this.router.navigate(['/browse', cat]);
    }
  }

  private loadProducts(category: string) {
    this.loading.set(true);
    this.productService.getAll(category || undefined).subscribe({
      next: (p) => { this.products.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
