import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { BasketItem } from '../models/basket.model';
import { Product } from '../models/product.model';

const mockBasketItem = (overrides: Partial<BasketItem> = {}): BasketItem => ({
  quantity: 2,
  product: {
    _id: 'prod1',
    name: 'Milk',
    description: 'Fresh',
    price: 1.50,
    category: 'Dairy',
    imageUrl: '',
    unit: 'per litre',
    stock: 100,
    featured: false,
  } as Product,
  ...overrides,
});

describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;
  const BASE = 'http://localhost:3000/api/orders';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('placeOrder()', () => {
    it('sends a POST with mapped items and delivery address', () => {
      const items = [mockBasketItem(), mockBasketItem({ quantity: 1, product: { ...mockBasketItem().product, _id: 'prod2', name: 'Eggs', price: 3.00 } as Product })];
      const address = { line1: '1 Farm Rd', city: 'London', postcode: 'SW1 1AA' };

      service.placeOrder(items, address, 'centre1', 'Leave at door').subscribe();

      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('POST');

      // Items should be mapped to plain objects with product id, not the full product
      expect(req.request.body.items[0]).toEqual({
        product: 'prod1',
        name: 'Milk',
        price: 1.50,
        quantity: 2,
      });
      expect(req.request.body.deliveryAddress).toEqual(address);
      expect(req.request.body.centre).toBe('centre1');
      expect(req.request.body.notes).toBe('Leave at door');

      req.flush({ _id: 'order1', total: 6.00, status: 'pending', items: [], createdAt: '' });
    });
  });

  describe('getMyOrders()', () => {
    it('fetches orders from /my endpoint', () => {
      service.getMyOrders().subscribe();
      const req = httpMock.expectOne(`${BASE}/my`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getById()', () => {
    it('fetches a single order by id', () => {
      service.getById('order123').subscribe();
      const req = httpMock.expectOne(`${BASE}/order123`);
      expect(req.request.method).toBe('GET');
      req.flush({ _id: 'order123', total: 9.00, status: 'pending', items: [], createdAt: '' });
    });
  });
});
