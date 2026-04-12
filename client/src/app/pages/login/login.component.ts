import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule,
    MatButtonModule, MatFormFieldModule, MatInputModule, MatTabsModule, MatSlideToggleModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  activeTab = signal(0);
  error = signal('');
  loading = signal(false);
  isFarm = signal(false); // toggle between customer and farm registration

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  registerForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    postcode: [''],
    // Farm-specific fields
    farmName: [''],
    farmDescription: [''],
    farmLocation: [''],
  });

  ngOnInit() {
    if (this.route.snapshot.url[0]?.path === 'register') {
      this.activeTab.set(1);
    }
  }

  toggleFarm(checked: boolean) {
    this.isFarm.set(checked);
    const farmName = this.registerForm.get('farmName')!;
    if (checked) {
      farmName.setValidators(Validators.required);
    } else {
      farmName.clearValidators();
    }
    farmName.updateValueAndValidity();
  }

  onLogin() {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.loginForm.value;
    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        // Redirect farms to their dashboard
        if (res.user.role === 'farm') {
          this.router.navigate(['/farm-dashboard']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => { this.error.set(err.error?.message ?? 'Login failed'); this.loading.set(false); },
    });
  }

  onRegister() {
    if (this.registerForm.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { name, email, password, postcode, farmName, farmDescription, farmLocation } = this.registerForm.value;
    const role = this.isFarm() ? 'farm' : 'customer';

    this.auth.register(name!, email!, password!, postcode ?? '', role, farmName ?? '', farmDescription ?? '', farmLocation ?? '')
      .subscribe({
        next: (res) => {
          if (res.user.role === 'farm') {
            this.router.navigate(['/farm-dashboard']);
          } else {
            this.router.navigate(['/']);
          }
        },
        error: (err) => { this.error.set(err.error?.message ?? 'Registration failed'); this.loading.set(false); },
      });
  }
}
