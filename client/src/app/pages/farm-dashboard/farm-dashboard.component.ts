import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { Product } from '../../models/product.model';
import { Order, OrderStatus, VALID_TRANSITIONS } from '../../models/order.model';
import { FarmProfile } from '../../models/user.model';

const CATEGORIES = ['Dairy', 'Beef', 'Pork', 'Vegetables', 'Eggs', 'Poultry'] as const;

@Component({
  selector: 'app-farm-dashboard',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule, CurrencyPipe, DatePipe, TitleCasePipe,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatIconModule, MatDialogModule, MatTabsModule, MatProgressSpinnerModule,
  ],
  templateUrl: './farm-dashboard.component.html',
  styleUrl: './farm-dashboard.component.scss',
})
export class FarmDashboardComponent implements OnInit {
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private auth = inject(AuthService);
  private cloudinary = inject(CloudinaryService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  products = signal<Product[]>([]);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  error = signal('');

  togglingFeaturedId = signal<string | null>(null);
  farmFeaturedCount  = computed(() => this.products().filter(p => p.farmFeatured).length);
  lowStockProducts   = computed(() => this.products().filter(p => p.stock > 0 && p.stock <= 5));

  totalRevenue = computed(() =>
    this.orders()
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0)
  );

  pendingCount = computed(() =>
    this.orders().filter(o => o.status === 'pending').length
  );

  topProducts = computed(() => {
    const qty: Record<string, { name: string; quantity: number }> = {};
    for (const order of this.orders()) {
      if (order.status === 'cancelled') continue;
      for (const item of order.items) {
        if (!qty[item.name]) qty[item.name] = { name: item.name, quantity: 0 };
        qty[item.name].quantity += item.quantity;
      }
    }
    return Object.values(qty)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);
  });

  orders = signal<Order[]>([]);
  updatingOrderId = signal<string | null>(null);

  imageUploading = signal(false);
  imageUploadError = signal('');

  profileLoading = signal(true);
  profileSaving = signal(false);
  profileSaved = signal(false);
  profileError = signal('');

  profileForm = this.fb.group({
    name: ['', Validators.required],
    farmName: ['', Validators.required],
    farmDescription: [''],
    farmLocation: [''],
  });

  readonly statuses: OrderStatus[] = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'];

  isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    return VALID_TRANSITIONS[from].includes(to);
  }

  hasValidTransitions(status: OrderStatus): boolean {
    return VALID_TRANSITIONS[status].length > 0;
  }

  readonly categories = CATEGORIES;

  form = this.fb.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0.01)]],
    category: ['', Validators.required],
    unit: ['each', Validators.required],
    imageUrl: [''],
    stock: [100],
  });

  ngOnInit() {
    // Redirect non-farms away
    const user = this.auth.currentUser();
    if (!user || user.role !== 'farm') {
      this.router.navigate(['/']);
      return;
    }
    this.loadProducts();
    this.loadOrders();
    this.loadProfile();
  }

  loadProfile() {
    this.auth.getMe().subscribe({
      next: (profile: FarmProfile) => {
        this.profileForm.setValue({
          name: profile.name ?? '',
          farmName: profile.farmName ?? '',
          farmDescription: profile.farmDescription ?? '',
          farmLocation: profile.farmLocation ?? '',
        });
        this.profileLoading.set(false);
      },
      error: () => this.profileLoading.set(false),
    });
  }

  saveProfile() {
    if (this.profileForm.invalid) return;
    this.profileSaving.set(true);
    this.profileSaved.set(false);
    this.profileError.set('');

    this.auth.updateProfile(this.profileForm.value as { name: string; farmName: string; farmDescription: string; farmLocation: string }).subscribe({
      next: () => {
        this.profileSaving.set(false);
        this.profileSaved.set(true);
      },
      error: (err) => {
        this.profileError.set(err.error?.message ?? 'Failed to save profile');
        this.profileSaving.set(false);
      },
    });
  }

  loadOrders() {
    this.orderService.getFarmOrders().subscribe((o) => this.orders.set(o));
  }

  updateStatus(order: Order, newStatus: string) {
    this.updatingOrderId.set(order._id);
    this.orderService.updateStatus(order._id, newStatus).subscribe({
      next: (updated) => {
        this.orders.update((list) => list.map((o) => (o._id === updated._id ? updated : o)));
        this.updatingOrderId.set(null);
      },
      error: () => this.updatingOrderId.set(null),
    });
  }

  loadProducts() {
    const user = this.auth.currentUser();
    if (!user) return;
    this.productService.getAll(undefined, user.id).subscribe((p) => this.products.set(p));
  }

  onImageFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imageUploading.set(true);
    this.imageUploadError.set('');
    this.cloudinary.upload(file).subscribe({
      next: (url) => {
        this.form.patchValue({ imageUrl: url });
        this.imageUploading.set(false);
      },
      error: () => {
        this.imageUploadError.set('Upload failed — please try again.');
        this.imageUploading.set(false);
      },
    });
  }

  openAdd() {
    this.form.reset({ unit: 'each', stock: 100, price: 0 });
    this.editingId.set(null);
    this.showForm.set(true);
    this.error.set('');
  }

  openEdit(product: Product) {
    this.form.setValue({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      unit: product.unit,
      imageUrl: product.imageUrl ?? '',
      stock: product.stock,
    });
    this.editingId.set(product._id);
    this.showForm.set(true);
    this.error.set('');
  }

  cancelForm() {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');

    const data = this.form.value as Partial<Product>;
    const id = this.editingId();

    const req = id
      ? this.productService.update(id, data)
      : this.productService.create(data);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.loadProducts();
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Failed to save product');
        this.saving.set(false);
      },
    });
  }

  delete(product: Product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    this.productService.delete(product._id).subscribe(() => this.loadProducts());
  }

  toggleFarmFeatured(product: Product) {
    this.togglingFeaturedId.set(product._id);
    this.productService.update(product._id, { farmFeatured: !product.farmFeatured }).subscribe({
      next: (updated) => {
        this.products.update(list => list.map(p => p._id === updated._id ? updated : p));
        this.togglingFeaturedId.set(null);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Failed to update featured status');
        this.togglingFeaturedId.set(null);
      },
    });
  }
}
