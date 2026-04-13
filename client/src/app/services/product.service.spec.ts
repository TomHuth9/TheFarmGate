import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductService } from './product.service';
import { Product } from '../models/product.model';
import { environment } from '../../environments/environment';

const mockProduct = (): Product => ({
  _id: '1',
  name: 'Milk',
  description: 'Fresh milk',
  price: 1.50,
  category: 'Dairy',
  imageUrl: '',
  unit: 'per litre',
  stock: 50,
  featured: false,
});

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;
  const BASE = `${environment.apiUrl}/products`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAll()', () => {
    it('fetches all products with no params', () => {
      service.getAll().subscribe((products) => {
        expect(products).toHaveSize(1);
      });
      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('GET');
      req.flush([mockProduct()]);
    });

    it('appends a category query param', () => {
      service.getAll('Dairy').subscribe();
      const req = httpMock.expectOne(`${BASE}?category=Dairy`);
      expect(req.request.params.get('category')).toBe('Dairy');
      req.flush([]);
    });

    it('appends a farm query param', () => {
      service.getAll(undefined, 'farm123').subscribe();
      const req = httpMock.expectOne(`${BASE}?farm=farm123`);
      expect(req.request.params.get('farm')).toBe('farm123');
      req.flush([]);
    });

    it('appends both category and farm params together', () => {
      service.getAll('Beef', 'farm123').subscribe();
      const req = httpMock.expectOne((r) => r.url === BASE);
      expect(req.request.params.get('category')).toBe('Beef');
      expect(req.request.params.get('farm')).toBe('farm123');
      req.flush([]);
    });
  });

  describe('getFeatured()', () => {
    it('fetches products with featured=true param', () => {
      service.getFeatured().subscribe();
      const req = httpMock.expectOne(`${BASE}?featured=true`);
      expect(req.request.params.get('featured')).toBe('true');
      req.flush([]);
    });
  });

  describe('getById()', () => {
    it('fetches a single product by id', () => {
      service.getById('abc123').subscribe((p) => {
        expect(p.name).toBe('Milk');
      });
      const req = httpMock.expectOne(`${BASE}/abc123`);
      expect(req.request.method).toBe('GET');
      req.flush(mockProduct());
    });
  });

  describe('create()', () => {
    it('sends a POST with the product data', () => {
      const data = { name: 'Butter', description: 'Churned', price: 3.20, category: 'Dairy' as const, unit: 'per 250g' };
      service.create(data).subscribe((p) => {
        expect(p.name).toBe('Butter');
      });
      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.name).toBe('Butter');
      req.flush({ ...mockProduct(), ...data });
    });
  });

  describe('update()', () => {
    it('sends a PUT to the correct product url', () => {
      service.update('abc123', { price: 2.00 }).subscribe();
      const req = httpMock.expectOne(`${BASE}/abc123`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.price).toBe(2.00);
      req.flush({ ...mockProduct(), price: 2.00 });
    });
  });

  describe('delete()', () => {
    it('sends a DELETE to the correct product url', () => {
      service.delete('abc123').subscribe();
      const req = httpMock.expectOne(`${BASE}/abc123`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
