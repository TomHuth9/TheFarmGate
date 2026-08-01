import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe, SlicePipe, TitleCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { Order } from '../../models/order.model';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe, SlicePipe, TitleCasePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.scss',
})
export class MyOrdersComponent implements OnInit {
  private auth = inject(AuthService);
  private orderService = inject(OrderService);
  private router = inject(Router);

  orders = signal<Order[]>([]);
  loading = signal(true);
  expandedId = signal<string | null>(null);

  ngOnInit() {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.orderService.getMyOrders().subscribe({
      next: (o) => { this.orders.set(o); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggle(id: string) {
    this.expandedId.update(current => current === id ? null : id);
  }
}
