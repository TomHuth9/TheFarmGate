import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { Product } from '../../models/product.model';
import { Order } from '../../models/order.model';
import { AdminUser } from '../../models/user.model';
import { environment } from '../../../environments/environment';

const ORDERS_URL = `${environment.apiUrl}/orders`;
const PRODUCTS_URL = `${environment.apiUrl}/products`;
const USERS_URL = `${environment.apiUrl}/users`;

const ADMIN_USER = JSON.stringify({ id: 'admin1', name: 'Admin', email: 'admin@example.com', role: 'admin' });
const CUSTOMER_USER = JSON.stringify({ id: 'cust1', name: 'Alice', email: 'alice@example.com', role: 'customer' });

const mockOrder = (overrides: Partial<Order> = {}): Order => ({
  _id: 'order1',
  items: [{ product: 'prod1', name: 'Milk', price: 1.5, quantity: 2 }],
  total: 3.0,
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

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

const mockUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  _id: 'user1',
  name: 'Bob',
  email: 'bob@example.com',
  role: 'customer',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

function setup(storedUser: string | null) {
  localStorage.clear();
  if (storedUser) localStorage.setItem('tfg_user', storedUser);

  TestBed.configureTestingModule({
    imports: [AdminDashboardComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
  });

  const fixture = TestBed.createComponent(AdminDashboardComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  return { fixture, component, httpMock, router };
}

function flushInit(httpMock: HttpTestingController, orders: Order[] = [], products: Product[] = [], users: AdminUser[] = []) {
  httpMock.expectOne(ORDERS_URL).flush(orders);
  httpMock.expectOne(PRODUCTS_URL).flush(products);
  httpMock.expectOne(USERS_URL).flush(users);
}

describe('AdminDashboardComponent', () => {
  afterEach(() => localStorage.clear());

  describe('ngOnInit()', () => {
    it('redirects non-admin users away without loading data', () => {
      const { fixture, httpMock, router } = setup(CUSTOMER_USER);
      spyOn(router, 'navigate');

      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
      httpMock.expectNone(ORDERS_URL);
      httpMock.expectNone(PRODUCTS_URL);
      httpMock.expectNone(USERS_URL);
    });

    it('loads orders, products, and users for an admin', () => {
      const { fixture, component, httpMock } = setup(ADMIN_USER);

      fixture.detectChanges();
      flushInit(httpMock, [mockOrder()], [mockProduct()], [mockUser()]);

      expect(component.orders()).toHaveSize(1);
      expect(component.products()).toHaveSize(1);
      expect(component.users()).toHaveSize(1);
    });
  });

  describe('currentUserId', () => {
    it('reflects the logged-in admin id', () => {
      const { fixture, component, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock);

      expect(component.currentUserId).toBe('admin1');
    });
  });

  describe('rendering', () => {
    it('shows the empty state for each tab when there is no data', () => {
      const { fixture, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock);
      fixture.detectChanges();

      const tabContents = fixture.nativeElement.querySelectorAll('.tab-content');
      expect(tabContents.length).toBe(3);
      tabContents.forEach((tab: HTMLElement) => expect(tab.querySelector('.empty-state')).toBeTruthy());
    });

    it('renders a row per user when users exist', () => {
      const { fixture, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock, [], [], [mockUser(), mockUser({ _id: 'user2' })]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.data-row').length).toBe(2);
    });
  });

  describe('updateOrderStatus()', () => {
    it('marks the order as updating, then applies the new status', () => {
      const { fixture, component, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock, [mockOrder()]);

      const order = component.orders()[0];
      component.updateOrderStatus(order, 'confirmed');

      expect(component.updatingOrderId()).toBe('order1');

      httpMock.expectOne(`${ORDERS_URL}/order1/status`).flush(mockOrder({ status: 'confirmed' }));

      expect(component.updatingOrderId()).toBeNull();
      expect(component.orders()[0].status).toBe('confirmed');
    });
  });

  describe('updateUserRole()', () => {
    it('marks the user as updating, then applies the new role', () => {
      const { fixture, component, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock, [], [], [mockUser()]);

      const user = component.users()[0];
      component.updateUserRole(user, 'farm');

      expect(component.updatingUserId()).toBe('user1');

      httpMock.expectOne(`${USERS_URL}/user1/role`).flush(mockUser({ role: 'farm' }));

      expect(component.updatingUserId()).toBeNull();
      expect(component.users()[0].role).toBe('farm');
    });

    it('clears updatingUserId without changing the role on failure', () => {
      const { fixture, component, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock, [], [], [mockUser()]);

      component.updateUserRole(component.users()[0], 'farm');
      httpMock
        .expectOne(`${USERS_URL}/user1/role`)
        .flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

      expect(component.updatingUserId()).toBeNull();
      expect(component.users()[0].role).toBe('customer');
    });
  });

  describe('deleteUser()', () => {
    it('does nothing when the confirmation is dismissed', () => {
      const { fixture, component, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock, [], [], [mockUser()]);

      spyOn(window, 'confirm').and.returnValue(false);
      component.deleteUser(component.users()[0]);

      httpMock.expectNone(`${USERS_URL}/user1`);
    });

    it('deletes and removes the user from the list when confirmed', () => {
      const { fixture, component, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock, [], [], [mockUser()]);

      spyOn(window, 'confirm').and.returnValue(true);
      component.deleteUser(component.users()[0]);

      const req = httpMock.expectOne(`${USERS_URL}/user1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(component.users()).toHaveSize(0);
    });
  });

  describe('deleteProduct()', () => {
    it('deletes and removes the product from the list when confirmed', () => {
      const { fixture, component, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock, [], [mockProduct()], []);

      spyOn(window, 'confirm').and.returnValue(true);
      component.deleteProduct(component.products()[0]);

      const req = httpMock.expectOne(`${PRODUCTS_URL}/prod1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(component.products()).toHaveSize(0);
    });

    it('does nothing when the confirmation is dismissed', () => {
      const { fixture, component, httpMock } = setup(ADMIN_USER);
      fixture.detectChanges();
      flushInit(httpMock, [], [mockProduct()], []);

      spyOn(window, 'confirm').and.returnValue(false);
      component.deleteProduct(component.products()[0]);

      httpMock.expectNone(`${PRODUCTS_URL}/prod1`);
    });
  });
});
