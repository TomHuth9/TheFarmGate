import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Farm } from '../models/user.model';
import { Product } from '../models/product.model';
import { environment } from '../../environments/environment';

export interface FarmProfileResponse {
  farm: Farm;
  products: Product[];
}

@Injectable({ providedIn: 'root' })
export class FarmService {
  private readonly API = `${environment.apiUrl}/farms`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Farm[]> {
    return this.http.get<Farm[]>(this.API);
  }

  getProfile(id: string): Observable<FarmProfileResponse> {
    return this.http.get<FarmProfileResponse>(`${this.API}/${id}`);
  }
}
