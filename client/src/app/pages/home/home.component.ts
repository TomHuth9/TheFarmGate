import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { BasketService } from '../../services/basket.service';
import { Product } from '../../models/product.model';
import { Farm } from '../../models/user.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, CurrencyPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private productService = inject(ProductService);
  private http = inject(HttpClient);
  basket = inject(BasketService);

  featured = signal<Product[]>([]);
  farms    = signal<Farm[]>([]);

  readonly categories = [
    { name: 'Dairy',      icon: 'water_drop',   route: '/browse/Dairy' },
    { name: 'Beef',       icon: 'set_meal',      route: '/browse/Beef' },
    { name: 'Pork',       icon: 'kebab_dining',  route: '/browse/Pork' },
    { name: 'Vegetables', icon: 'eco',           route: '/browse/Vegetables' },
    { name: 'Eggs',       icon: 'egg',           route: '/browse/Eggs' },
    { name: 'Poultry',    icon: 'bakery_dining', route: '/browse/Poultry' },
  ];

  ngOnInit() {
    this.productService.getFeatured().subscribe((products) => this.featured.set(products));
    this.http.get<Farm[]>(`${environment.apiUrl}/farms`).subscribe({
      next: (all) => this.farms.set(all.slice(0, 3)),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      error: () => {},
    });
  }
}
