import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { User, AuthResponse, FarmProfile } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/users`;
  private readonly USER_KEY = 'tfg_user';

  // Reactive signal for current user state
  currentUser = signal<User | null>(this.loadUserFromStorage());

  constructor(private http: HttpClient, private router: Router) {}

  register(
    name: string,
    email: string,
    password: string,
    postcode: string,
    role: 'customer' | 'farm' = 'customer',
    farmName = '',
    farmDescription = '',
    farmLocation = ''
  ) {
    return this.http
      .post<AuthResponse>(`${this.API}/register`, {
        name, email, password, postcode, role, farmName, farmDescription, farmLocation,
      })
      .pipe(tap((res) => this.handleAuth(res)));
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>(`${this.API}/login`, { email, password })
      .pipe(tap((res) => this.handleAuth(res)));
  }

  forgotPassword(email: string) {
    return this.http.post(`${this.API}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string) {
    return this.http.post(`${this.API}/reset-password/${token}`, { password });
  }

  logout() {
    this.http.post(`${this.API}/logout`, {}).subscribe({
      complete: () => this.clearSession(),
      error: () => this.clearSession(),
    });
  }

  getMe(): Observable<FarmProfile> {
    return this.http.get<FarmProfile>(`${this.API}/me`);
  }

  updateProfile(data: { name?: string; farmName?: string; farmDescription?: string; farmLocation?: string }) {
    return this.http.patch<FarmProfile>(`${this.API}/me`, data).pipe(
      tap((updated) => {
        const current = this.currentUser();
        if (current) {
          const merged = { ...current, name: updated.name, farmName: updated.farmName };
          localStorage.setItem(this.USER_KEY, JSON.stringify(merged));
          this.currentUser.set(merged);
        }
      })
    );
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  verifyEmail(token: string) {
    return this.http.get<{ message: string }>(`${this.API}/verify-email/${token}`);
  }

  private handleAuth(res: AuthResponse) {
    if (res.user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
      this.currentUser.set(res.user);
    }
  }

  private clearSession() {
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  private loadUserFromStorage(): User | null {
    try {
      const stored = localStorage.getItem(this.USER_KEY);
      return stored ? (JSON.parse(stored) as User) : null;
    } catch {
      return null;
    }
  }
}
