import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe, DatePipe, SlicePipe, TitleCasePipe } from '@angular/common';
import { OrderService } from '../../services/order.service';
import { Order, OrderStatus } from '../../models/order.model';

const STATUS_STEPS: OrderStatus[] = ['pending', 'confirmed', 'dispatched', 'delivered'];

@Component({
  selector: 'app-order-confirmation',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe, SlicePipe, TitleCasePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './order-confirmation.component.html',
  styleUrl: './order-confirmation.component.scss',
})
export class OrderConfirmationComponent implements OnInit {
  private orderService = inject(OrderService);
  private route = inject(ActivatedRoute);

  order = signal<Order | null>(null);
  loading = signal(true);
  cancelling = signal(false);

  readonly steps = [
    { key: 'pending' as OrderStatus,    label: 'Placed',     icon: 'shopping_bag' },
    { key: 'confirmed' as OrderStatus,  label: 'Confirmed',  icon: 'thumb_up' },
    { key: 'dispatched' as OrderStatus, label: 'Dispatched', icon: 'local_shipping' },
    { key: 'delivered' as OrderStatus,  label: 'Delivered',  icon: 'home' },
  ];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.orderService.getById(id).subscribe({
      next: (o) => { this.order.set(o); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  stepIndex(status: OrderStatus): number {
    return STATUS_STEPS.indexOf(status);
  }

  cancelOrder() {
    const o = this.order();
    if (!o || !confirm('Are you sure you want to cancel this order?')) return;
    this.cancelling.set(true);
    this.orderService.updateStatus(o._id, 'cancelled').subscribe({
      next: (updated) => { this.order.set(updated); this.cancelling.set(false); },
      error: () => this.cancelling.set(false),
    });
  }
}
