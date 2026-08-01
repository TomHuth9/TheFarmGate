import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe } from '@angular/common';
import { FarmService } from '../../services/farm.service';
import { BasketService } from '../../services/basket.service';
import { Farm } from '../../models/user.model';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-farm-profile',
  standalone: true,
  imports: [
    RouterLink, CurrencyPipe, ReactiveFormsModule,
    MatButtonModule, MatCardModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressSpinnerModule,
  ],
  templateUrl: './farm-profile.component.html',
  styleUrl: './farm-profile.component.scss',
})
export class FarmProfileComponent implements OnInit {
  private farmService = inject(FarmService);
  private route = inject(ActivatedRoute);
  basket = inject(BasketService);

  farm = signal<Farm | null>(null);
  products = signal<Product[]>([]);
  featuredProducts = computed(() => this.products().filter(p => p.farmFeatured));
  loading = signal(true);

  searchControl = new FormControl('');
  private searchTerm = signal('');

  filteredProducts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.products();
    return this.products().filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term)
    );
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.farmService.getProfile(id).subscribe({
      next: ({ farm, products }) => {
        this.farm.set(farm);
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.searchControl.valueChanges.subscribe((v) => this.searchTerm.set(v ?? ''));
  }
}
