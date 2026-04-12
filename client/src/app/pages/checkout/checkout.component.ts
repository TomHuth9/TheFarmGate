import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from '@angular/common';
import { BasketService } from '../../services/basket.service';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule, CurrencyPipe,
    MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule,
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent {
  private fb = inject(FormBuilder);
  private orderService = inject(OrderService);
  private router = inject(Router);
  basket = inject(BasketService);
  auth = inject(AuthService);

  submitting = signal(false);
  error = signal('');

  form = this.fb.group({
    line1: ['', Validators.required],
    line2: [''],
    city: ['', Validators.required],
    postcode: ['', Validators.required],
    notes: [''],
  });

  submit() {
    if (this.form.invalid || this.basket.items().length === 0) return;

    this.submitting.set(true);
    this.error.set('');

    const { line1, line2, city, postcode, notes } = this.form.value;

    this.orderService
      .placeOrder(this.basket.items(), { line1, line2, city, postcode }, undefined, notes ?? '')
      .subscribe({
        next: (order) => {
          this.basket.clear();
          this.router.navigate(['/order-confirmation', order._id]);
        },
        error: (err) => {
          this.error.set(err.error?.message ?? 'Failed to place order. Please try again.');
          this.submitting.set(false);
        },
      });
  }
}
