import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatProgressSpinnerModule,
  ],
  templateUrl: './customer-profile.component.html',
  styleUrl: './customer-profile.component.scss',
})
export class CustomerProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  form = this.fb.group({
    name:     ['', [Validators.required, Validators.maxLength(100)]],
    email:    [{ value: '', disabled: true }],
    postcode: ['', [Validators.maxLength(10), Validators.pattern(/^[A-Z0-9 ]*$/i)]],
  });

  loading = signal(true);
  saving = signal(false);
  saved = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    const user = this.auth.currentUser();
    if (!user || user.role !== 'customer') {
      this.router.navigate(['/']);
      return;
    }

    this.auth.getMe().subscribe({
      next: (profile: any) => {
        this.form.patchValue({
          name: profile.name,
          email: profile.email,
          postcode: profile.postcode ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.form.patchValue({ name: user.name, email: user.email });
        this.loading.set(false);
      },
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);

    const { name, postcode } = this.form.getRawValue();
    this.auth.updateMe({ name: name ?? '', postcode: postcode ?? '' }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Could not save profile');
      },
    });
  }
}
