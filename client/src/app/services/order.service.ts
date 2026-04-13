import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order } from '../models/order.model';
import { BasketItem } from '../models/basket.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly API = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  placeOrder(
    items: BasketItem[],
    deliveryAddress: object,
    centreId?: string,
    notes?: string
  ): Observable<Order> {
    const payload = {
      items: items.map((i) => ({
        product: i.product._id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity,
      })),
      deliveryAddress,
      centre: centreId,
      notes,
    };
    return this.http.post<Order>(this.API, payload);
  }

  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.API}/my`);
  }

  getById(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.API}/${id}`);
  }
}
