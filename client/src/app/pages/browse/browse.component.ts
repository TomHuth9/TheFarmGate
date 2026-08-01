import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { BasketService } from '../../services/basket.service';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [
    RouterLink, CurrencyPipe, ReactiveFormsModule,
    MatButtonModule, MatButtonToggleModule, MatCardModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
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
  searchControl = new FormControl('');

  readonly categories = ['All', 'Dairy', 'Beef', 'Pork', 'Vegetables', 'Eggs', 'Poultry'];

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const cat = params.get('category') ?? '';
      this.activeCategory.set(cat);
      this.searchControl.setValue('', { emitEvent: false });
      this.loadProducts(cat, '');
    });

    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe((term) => {
      this.loadProducts(this.activeCategory(), term ?? '');
    });
  }

  selectCategory(cat: string) {
    if (cat === 'All') {
      this.router.navigate(['/browse']);
    } else {
      this.router.navigate(['/browse', cat]);
    }
  }

  private loadProducts(category: string, search: string) {
    this.loading.set(true);
    this.productService.getAll(category || undefined, undefined, search || undefined).subscribe({
      next: (p) => { this.products.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
