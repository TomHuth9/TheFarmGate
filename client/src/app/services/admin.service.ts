import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminUser } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly API = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(this.API);
  }

  updateUserRole(id: string, role: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.API}/${id}/role`, { role });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}
