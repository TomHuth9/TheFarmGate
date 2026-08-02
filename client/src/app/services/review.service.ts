import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Review, ReviewPage } from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getForProduct(productId: string, page = 1): Observable<ReviewPage> {
    return this.http.get<ReviewPage>(`${this.base}/products/${productId}/reviews`, {
      params: { page: String(page) },
    });
  }

  submit(productId: string, rating: number, body: string): Observable<Review> {
    return this.http.post<Review>(`${this.base}/products/${productId}/reviews`, { rating, body });
  }
}
