import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { User, AuthResponse } from '../models/user.model';
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

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  private handleAuth(res: AuthResponse) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this.currentUser.set(res.user);
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
