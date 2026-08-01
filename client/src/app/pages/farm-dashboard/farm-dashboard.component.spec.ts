import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { MatTabGroup } from '@angular/material/tabs';
import { FarmDashboardComponent } from './farm-dashboard.component';
import { Product } from '../../models/product.model';
import { Order } from '../../models/order.model';
import { environment } from '../../../environments/environment';

const PRODUCTS_URL = `${environment.apiUrl}/products`;
const FARM_ORDERS_URL = `${environment.apiUrl}/orders/farm`;

const FARM_USER = JSON.stringify({ id: 'farm1', name: 'Meadow View', email: 'farm@example.com', role: 'farm' });
const CUSTOMER_USER = JSON.stringify({ id: 'cust1', name: 'Alice', email: 'alice@example.com', role: 'customer' });

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  _id: 'prod1',
  name: 'Milk',
  description: 'Fresh',
  price: 1.5,
  category: 'Dairy',
  imageUrl: '',
  unit: 'per litre',
  stock: 10,
  featured: false,
  ...overrides,
});

const mockOrder = (overrides: Partial<Order> = {}): Order => ({
  _id: 'order1',
  items: [{ product: 'prod1', name: 'Milk', price: 1.5, quantity: 2 }],
  total: 3.0,
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

function setup(storedUser: string | null) {
  localStorage.clear();
  if (storedUser) localStorage.setItem('tfg_user', storedUser);

  TestBed.configureTestingModule({
    imports: [FarmDashboardComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
  });

  const fixture = TestBed.createComponent(FarmDashboardComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  return { fixture, component, httpMock, router };
}

describe('FarmDashboardComponent', () => {
  afterEach(() => localStorage.clear());

  describe('ngOnInit()', () => {
    it('redirects non-farm users away without loading data', () => {
      const { fixture, httpMock, router } = setup(CUSTOMER_USER);
      spyOn(router, 'navigate');

      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
      httpMock.expectNone(PRODUCTS_URL);
      httpMock.expectNone(FARM_ORDERS_URL);
    });

    it('loads the farm\'s products and orders', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);

      fixture.detectChanges();

      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct()]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([mockOrder()]);

      expect(component.products()).toHaveSize(1);
      expect(component.orders()).toHaveSize(1);
    });
  });

  describe('rendering', () => {
    it('shows the empty state when there are no orders', () => {
      const { fixture, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([]);
      fixture.detectChanges();

      // Activate the Orders tab — Angular Material detaches inactive portals, so only
      // the active tab's .tab-content is in the DOM at any given time.
      // Two detectChanges: one to start the noop animation, one to process its done callback.
      fixture.debugElement.query(By.directive(MatTabGroup)).componentInstance.selectedIndex = 1;
      fixture.detectChanges();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.tab-content .empty-state')).toBeTruthy();
    });

    it('loads the correct number of orders', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([mockOrder(), mockOrder({ _id: 'order2' })]);

      expect(component.orders()).toHaveSize(2);
    });
  });

  describe('updateStatus()', () => {
    it('marks the order as updating, then applies the new status', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([mockOrder()]);

      const order = component.orders()[0];
      component.updateStatus(order, 'confirmed');

      expect(component.updatingOrderId()).toBe('order1');

      httpMock.expectOne(`${FARM_ORDERS_URL.replace('/farm', '')}/order1/status`).flush(mockOrder({ status: 'confirmed' }));

      expect(component.updatingOrderId()).toBeNull();
      expect(component.orders()[0].status).toBe('confirmed');
    });

    it('clears updatingOrderId on failure without changing the order', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([mockOrder()]);

      component.updateStatus(component.orders()[0], 'confirmed');
      httpMock
        .expectOne(`${environment.apiUrl}/orders/order1/status`)
        .flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

      expect(component.updatingOrderId()).toBeNull();
      expect(component.orders()[0].status).toBe('pending');
    });
  });

  describe('save()', () => {
    it('POSTs a new product when adding, then reloads the list', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([]);

      component.openAdd();
      component.form.setValue({
        name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen', imageUrl: '', stock: 50,
      });
      component.save();

      const req = httpMock.expectOne(PRODUCTS_URL);
      expect(req.request.method).toBe('POST');
      req.flush(mockProduct({ _id: 'prod2', name: 'Eggs' }));

      expect(component.showForm()).toBeFalse();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct({ _id: 'prod2', name: 'Eggs' })]);
    });

    it('PUTs to the product id when editing an existing product', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct()]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([]);

      component.openEdit(component.products()[0]);
      component.save();

      const req = httpMock.expectOne(`${PRODUCTS_URL}/prod1`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockProduct());

      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct()]);
    });

    it('sets the error signal and stops saving on failure', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([]);

      component.openAdd();
      component.form.setValue({
        name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen', imageUrl: '', stock: 50,
      });
      component.save();

      httpMock
        .expectOne(PRODUCTS_URL)
        .flush({ message: 'Could not save product' }, { status: 400, statusText: 'Bad Request' });

      expect(component.error()).toBe('Could not save product');
      expect(component.saving()).toBeFalse();
    });
  });

  describe('delete()', () => {
    it('does nothing when the confirmation is dismissed', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct()]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([]);

      spyOn(window, 'confirm').and.returnValue(false);
      component.delete(component.products()[0]);

      httpMock.expectNone(`${PRODUCTS_URL}/prod1`);
    });

    it('deletes and reloads the product list when confirmed', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct()]);
      httpMock.expectOne(FARM_ORDERS_URL).flush([]);

      spyOn(window, 'confirm').and.returnValue(true);
      component.delete(component.products()[0]);

      const req = httpMock.expectOne(`${PRODUCTS_URL}/prod1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
    });
  });
});
