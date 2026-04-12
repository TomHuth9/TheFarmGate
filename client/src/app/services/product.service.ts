import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly API = 'http://localhost:3000/api/products';

  constructor(private http: HttpClient) {}

  getAll(category?: string, farmId?: string): Observable<Product[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    if (farmId) params = params.set('farm', farmId);
    return this.http.get<Product[]>(this.API, { params });
  }

  getFeatured(): Observable<Product[]> {
    return this.http.get<Product[]>(this.API, { params: { featured: 'true' } });
  }

  getById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.API}/${id}`);
  }

  create(data: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(this.API, data);
  }

  update(id: string, data: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.API}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`);
  }
}
