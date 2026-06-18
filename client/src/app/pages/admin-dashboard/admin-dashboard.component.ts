import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { ProductService } from '../../services/product.service';
import { AdminService } from '../../services/admin.service';
import { Order } from '../../models/order.model';
import { Product } from '../../models/product.model';
import { AdminUser } from '../../models/user.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CurrencyPipe, DatePipe, TitleCasePipe,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatTabsModule, MatProgressSpinnerModule,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private orderService = inject(OrderService);
  private productService = inject(ProductService);
  private adminService = inject(AdminService);
  private router = inject(Router);

  orders = signal<Order[]>([]);
  products = signal<Product[]>([]);
  users = signal<AdminUser[]>([]);
  updatingOrderId = signal<string | null>(null);
  updatingUserId = signal<string | null>(null);

  readonly orderStatuses: Order['status'][] = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
  readonly userRoles: AdminUser['role'][] = ['customer', 'farm', 'admin'];

  get currentUserId(): string {
    return this.auth.currentUser()?.id ?? '';
  }

  ngOnInit() {
    const user = this.auth.currentUser();
    if (!user || user.role !== 'admin') {
      this.router.navigate(['/']);
      return;
    }
    this.loadOrders();
    this.loadProducts();
    this.loadUsers();
  }

  loadOrders() {
    this.orderService.getAllOrders().subscribe((o) => this.orders.set(o));
  }

  loadProducts() {
    this.productService.getAll().subscribe((p) => this.products.set(p));
  }

  loadUsers() {
    this.adminService.getUsers().subscribe((u) => this.users.set(u));
  }

  updateOrderStatus(order: Order, newStatus: string) {
    this.updatingOrderId.set(order._id);
    this.orderService.updateStatus(order._id, newStatus).subscribe({
      next: (updated) => {
        this.orders.update((list) => list.map((o) => (o._id === updated._id ? updated : o)));
        this.updatingOrderId.set(null);
      },
      error: () => this.updatingOrderId.set(null),
    });
  }

  updateUserRole(user: AdminUser, newRole: string) {
    this.updatingUserId.set(user._id);
    this.adminService.updateUserRole(user._id, newRole).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u._id === updated._id ? updated : u)));
        this.updatingUserId.set(null);
      },
      error: () => this.updatingUserId.set(null),
    });
  }

  deleteUser(user: AdminUser) {
    if (!confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`)) return;
    this.adminService.deleteUser(user._id).subscribe(() => {
      this.users.update((list) => list.filter((u) => u._id !== user._id));
    });
  }

  deleteProduct(product: Product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    this.productService.delete(product._id).subscribe(() => {
      this.products.update((list) => list.filter((p) => p._id !== product._id));
    });
  }
}
