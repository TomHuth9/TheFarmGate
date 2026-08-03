import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { BasketService } from '../../services/basket.service';
import { Product } from '../../models/product.model';

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'name-asc';

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [
    RouterLink, CurrencyPipe, DecimalPipe, ReactiveFormsModule,
    MatAutocompleteModule, MatButtonModule, MatButtonToggleModule, MatCardModule,
    MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatSelectModule, MatSlideToggleModule,
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
  sort = signal<SortKey>('default');
  searchControl = new FormControl('');
  searchTerm = signal('');
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  inStockOnly = signal(false);

  hasActiveFilters = computed(() =>
    this.minPrice() !== null || this.maxPrice() !== null || this.inStockOnly()
  );

  suggestions = computed<string[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (term.length < 2) return [];
    return [...new Set(
      this.products()
        .filter(p => p.name.toLowerCase().includes(term))
        .map(p => p.name)
    )].slice(0, 6);
  });

  readonly categories = ['All', 'Dairy', 'Beef', 'Pork', 'Vegetables', 'Eggs', 'Poultry'];

  readonly sortOptions: { value: SortKey; label: string }[] = [
    { value: 'default',    label: 'Default order' },
    { value: 'price-asc',  label: 'Price: low to high' },
    { value: 'price-desc', label: 'Price: high to low' },
    { value: 'name-asc',   label: 'Name: A – Z' },
  ];

  displayProducts = computed<Product[]>(() => {
    let list = [...this.products()];
    const min = this.minPrice();
    const max = this.maxPrice();
    if (min !== null) list = list.filter(p => p.price >= min);
    if (max !== null) list = list.filter(p => p.price <= max);
    if (this.inStockOnly()) list = list.filter(p => p.stock > 0);
    switch (this.sort()) {
      case 'price-asc':  return list.sort((a, b) => a.price - b.price);
      case 'price-desc': return list.sort((a, b) => b.price - a.price);
      case 'name-asc':   return list.sort((a, b) => a.name.localeCompare(b.name));
      default:           return list;
    }
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const cat = params.get('category') ?? '';
      this.activeCategory.set(cat);
      this.searchControl.setValue('', { emitEvent: false });
      this.loadProducts(cat, '');
    });

    this.searchControl.valueChanges.subscribe(v => this.searchTerm.set(v ?? ''));

    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe((term) => {
      this.loadProducts(this.activeCategory(), term ?? '');
    });
  }

  setMinPrice(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.minPrice.set(isNaN(v) ? null : v);
  }

  setMaxPrice(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.maxPrice.set(isNaN(v) ? null : v);
  }

  clearFilters() {
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.inStockOnly.set(false);
  }

  selectCategory(cat: string) {
    this.sort.set('default');
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
