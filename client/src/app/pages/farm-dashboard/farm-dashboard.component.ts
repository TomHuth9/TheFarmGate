import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import { Product } from '../../models/product.model';

const CATEGORIES = ['Dairy', 'Beef', 'Pork', 'Vegetables', 'Eggs', 'Poultry'] as const;

@Component({
  selector: 'app-farm-dashboard',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule, CurrencyPipe,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatIconModule, MatDialogModule,
  ],
  templateUrl: './farm-dashboard.component.html',
  styleUrl: './farm-dashboard.component.scss',
})
export class FarmDashboardComponent implements OnInit {
  private productService = inject(ProductService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  products = signal<Product[]>([]);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  error = signal('');

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
  }

  loadProducts() {
    const user = this.auth.currentUser();
    if (!user) return;
    this.productService.getAll(undefined, user.id).subscribe((p) => this.products.set(p));
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
}
