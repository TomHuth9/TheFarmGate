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
const ME_URL = `${environment.apiUrl}/users/me`;

const mockProfile = {
  _id: 'farm1',
  name: 'Meadow View',
  email: 'farm@example.com',
  role: 'farm',
  farmName: 'Meadow View Farm',
  farmDescription: 'Beautiful views over the valley.',
  farmLocation: 'Devon, UK',
};

function flushAll(
  httpMock: HttpTestingController,
  { products = [] as any[], orders = [] as any[], profile = mockProfile } = {}
) {
  httpMock.expectOne((r) => r.url === PRODUCTS_URL).flush(products);
  httpMock.expectOne(FARM_ORDERS_URL).flush(orders);
  httpMock.expectOne(ME_URL).flush(profile);
}

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

  describe('saveProfile()', () => {
    it('pre-populates the profile form with data from GET /api/users/me', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock);

      expect(component.profileForm.value.farmName).toBe('Meadow View Farm');
      expect(component.profileForm.value.farmDescription).toBe('Beautiful views over the valley.');
      expect(component.profileForm.value.farmLocation).toBe('Devon, UK');
    });

    it('sets profileLoading to false after the profile loads', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();

      expect(component.profileLoading()).toBeTrue();

      flushAll(httpMock);

      expect(component.profileLoading()).toBeFalse();
    });

    it('PATCHes /api/users/me with the updated form values', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock);

      component.profileForm.setValue({
        name: 'Updated Name',
        farmName: 'Updated Farm',
        farmDescription: 'New description',
        farmLocation: 'New Location',
      });
      component.saveProfile();

      const req = httpMock.expectOne(ME_URL);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(jasmine.objectContaining({ farmName: 'Updated Farm' }));
      req.flush({ ...mockProfile, farmName: 'Updated Farm' });
    });

    it('sets profileSaved to true after a successful save', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock);

      component.saveProfile();
      httpMock.expectOne(ME_URL).flush(mockProfile);

      expect(component.profileSaved()).toBeTrue();
      expect(component.profileSaving()).toBeFalse();
    });

    it('sets profileError when the save fails', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock);

      component.saveProfile();
      httpMock.expectOne(ME_URL).flush(
        { message: 'Could not update profile' },
        { status: 500, statusText: 'Internal Server Error' }
      );

      expect(component.profileError()).toBe('Could not update profile');
      expect(component.profileSaving()).toBeFalse();
    });
  });

  describe('analytics computed signals', () => {
    it('totalRevenue() returns 0 when there are no orders', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock);

      expect(component.totalRevenue()).toBe(0);
    });

    it('totalRevenue() sums totals from non-cancelled orders only', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock, {
        orders: [
          mockOrder({ total: 10, status: 'confirmed' }),
          mockOrder({ _id: 'order2', total: 5, status: 'cancelled' }),
          mockOrder({ _id: 'order3', total: 7, status: 'delivered' }),
        ],
      });

      expect(component.totalRevenue()).toBeCloseTo(17);
    });

    it('pendingCount() counts only pending orders', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock, {
        orders: [
          mockOrder({ status: 'pending' }),
          mockOrder({ _id: 'order2', status: 'pending' }),
          mockOrder({ _id: 'order3', status: 'confirmed' }),
        ],
      });

      expect(component.pendingCount()).toBe(2);
    });

    it('topProducts() returns an empty array when no orders exist', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock);

      expect(component.topProducts()).toHaveSize(0);
    });

    it('topProducts() aggregates quantities across orders and sorts descending', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock, {
        orders: [
          mockOrder({
            items: [
              { product: 'p1', name: 'Milk', price: 1.5, quantity: 5 },
              { product: 'p2', name: 'Eggs', price: 2, quantity: 3 },
            ],
            total: 13.5,
            status: 'confirmed',
          }),
          mockOrder({
            _id: 'order2',
            items: [{ product: 'p1', name: 'Milk', price: 1.5, quantity: 4 }],
            total: 6,
            status: 'delivered',
          }),
        ],
      });

      const top = component.topProducts();
      expect(top[0]).toEqual({ name: 'Milk', quantity: 9 });
      expect(top[1]).toEqual({ name: 'Eggs', quantity: 3 });
    });

    it('topProducts() excludes items from cancelled orders', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock, {
        orders: [mockOrder({ status: 'cancelled' })],
      });

      expect(component.topProducts()).toHaveSize(0);
    });

    it('topProducts() returns at most 3 items even when more products have been sold', () => {
      const { fixture, component, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock, {
        orders: [
          mockOrder({
            items: [
              { product: 'p1', name: 'Milk', price: 1, quantity: 10 },
              { product: 'p2', name: 'Eggs', price: 1, quantity: 8 },
              { product: 'p3', name: 'Butter', price: 1, quantity: 6 },
              { product: 'p4', name: 'Cheese', price: 1, quantity: 4 },
            ],
            total: 28,
            status: 'confirmed',
          }),
        ],
      });

      expect(component.topProducts()).toHaveSize(3);
    });
  });

  describe('low stock indicators', () => {
    it('shows a low-stock badge for a product with 5 or fewer units remaining', () => {
      const { fixture, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock, { products: [mockProduct({ stock: 3 })] });
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.low-stock-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('3');
    });

    it('shows an out-of-stock badge and no low-stock badge when stock is 0', () => {
      const { fixture, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock, { products: [mockProduct({ stock: 0 })] });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.out-of-stock-badge')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.low-stock-badge')).toBeNull();
    });

    it('shows no stock badge for a product with more than 5 units', () => {
      const { fixture, httpMock } = setup(FARM_USER);
      fixture.detectChanges();
      flushAll(httpMock, { products: [mockProduct({ stock: 10 })] });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.low-stock-badge')).toBeNull();
      expect(fixture.nativeElement.querySelector('.out-of-stock-badge')).toBeNull();
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
