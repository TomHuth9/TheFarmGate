import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe, SlicePipe, TitleCasePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { ProductService } from '../../services/product.service';
import { BasketService } from '../../services/basket.service';
import { Order } from '../../models/order.model';

const STATUS_STEPS = ['pending', 'confirmed', 'dispatched', 'delivered'] as const;

interface TimelineStep {
  status: string;
  reached: boolean;
  changedAt: string | null;
}

interface ReorderResult {
  orderId: string;
  added: string[];
  outOfStock: string[];
}

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
  private productService = inject(ProductService);
  private basketService = inject(BasketService);
  private router = inject(Router);

  orders = signal<Order[]>([]);
  loading = signal(true);
  expandedId = signal<string | null>(null);
  cancellingId = signal<string | null>(null);
  reorderingId = signal<string | null>(null);
  reorderResult = signal<ReorderResult | null>(null);

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
    if (this.reorderResult()?.orderId !== id) {
      this.reorderResult.set(null);
    }
  }

  cancelOrder(id: string) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    this.cancellingId.set(id);
    this.orderService.updateStatus(id, 'cancelled').subscribe({
      next: (updated) => {
        this.orders.update(list => list.map(o => o._id === updated._id ? updated : o));
        this.cancellingId.set(null);
      },
      error: () => this.cancellingId.set(null),
    });
  }

  timelineSteps(order: Order): TimelineStep[] {
    const historyMap = new Map(
      (order.statusHistory ?? []).map(h => [h.status, h.changedAt])
    );

    if (order.status === 'cancelled') {
      const steps: TimelineStep[] = [];
      for (const s of STATUS_STEPS) {
        if (!historyMap.has(s)) break;
        steps.push({ status: s, reached: true, changedAt: historyMap.get(s) ?? null });
      }
      steps.push({ status: 'cancelled', reached: true, changedAt: historyMap.get('cancelled') ?? null });
      return steps;
    }

    return STATUS_STEPS.map(s => ({
      status: s,
      reached: historyMap.has(s),
      changedAt: historyMap.get(s) ?? null,
    }));
  }

  reorder(order: Order) {
    this.reorderingId.set(order._id);
    this.reorderResult.set(null);

    const requests = order.items.map(item => {
      const id = typeof item.product === 'string' ? item.product : (item.product as any)._id;
      return this.productService.getById(id).pipe(catchError(() => of(null)));
    });

    forkJoin(requests).subscribe(results => {
      const added: string[] = [];
      const outOfStock: string[] = [];

      results.forEach((product, i) => {
        const item = order.items[i];
        if (!product || product.stock < 1) {
          outOfStock.push(item.name);
        } else {
          this.basketService.add(product, item.quantity);
          added.push(item.name);
        }
      });

      this.reorderingId.set(null);
      this.reorderResult.set({ orderId: order._id, added, outOfStock });
    });
  }
}
