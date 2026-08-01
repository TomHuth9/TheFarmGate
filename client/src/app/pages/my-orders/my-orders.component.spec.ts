import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MyOrdersComponent } from './my-orders.component';
import { Order } from '../../models/order.model';
import { environment } from '../../../environments/environment';

const MY_ORDERS_URL = `${environment.apiUrl}/orders/my`;

const CUSTOMER = JSON.stringify({ id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'customer' });

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
    imports: [MyOrdersComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
  });

  const fixture = TestBed.createComponent(MyOrdersComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  return { fixture, component, httpMock, router };
}

describe('MyOrdersComponent', () => {
  afterEach(() => localStorage.clear());

  describe('ngOnInit()', () => {
    it('redirects to /login when the user is not logged in', () => {
      const { fixture, httpMock, router } = setup(null);
      spyOn(router, 'navigate');

      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/login']);
      httpMock.expectNone(MY_ORDERS_URL);
    });

    it('fetches orders and stops loading on success', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();

      expect(component.loading()).toBeTrue();

      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder(), mockOrder({ _id: 'order2' })]);

      expect(component.loading()).toBeFalse();
      expect(component.orders()).toHaveSize(2);
    });

    it('stops loading on HTTP error without throwing', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();

      httpMock.expectOne(MY_ORDERS_URL).flush(
        { message: 'Unauthorised' },
        { status: 401, statusText: 'Unauthorised' },
      );

      expect(component.loading()).toBeFalse();
      expect(component.orders()).toHaveSize(0);
    });
  });

  describe('rendering', () => {
    it('shows a spinner while loading', () => {
      const { fixture } = setup(CUSTOMER);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
      expect(fixture.nativeElement.querySelector('.order-list')).toBeNull();
    });

    it('shows the empty state when there are no orders', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.order-list')).toBeNull();
    });

    it('renders one card per order', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder(), mockOrder({ _id: 'order2' })]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.order-card').length).toBe(2);
    });

    it('applies the correct status chip class', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([
        mockOrder({ status: 'pending' }),
        mockOrder({ _id: 'order2', status: 'delivered' }),
      ]);
      fixture.detectChanges();

      const chips = fixture.nativeElement.querySelectorAll('.status-chip');
      expect(chips[0].classList).toContain('status-pending');
      expect(chips[1].classList).toContain('status-delivered');
    });
  });

  describe('toggle()', () => {
    it('expands an order when its header is clicked', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder()]);
      fixture.detectChanges();

      expect(component.expandedId()).toBeNull();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      expect(component.expandedId()).toBe('order1');
      expect(fixture.nativeElement.querySelector('.order-body')).toBeTruthy();
    });

    it('collapses an already-expanded order when clicked again', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder()]);
      fixture.detectChanges();

      const header = fixture.nativeElement.querySelector('.order-header');
      header.click(); fixture.detectChanges();
      header.click(); fixture.detectChanges();

      expect(component.expandedId()).toBeNull();
      expect(fixture.nativeElement.querySelector('.order-body')).toBeNull();
    });

    it('switches expansion to a different order', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder(), mockOrder({ _id: 'order2' })]);
      fixture.detectChanges();

      const headers = fixture.nativeElement.querySelectorAll('.order-header');
      headers[0].click(); fixture.detectChanges();
      expect(component.expandedId()).toBe('order1');

      headers[1].click(); fixture.detectChanges();
      expect(component.expandedId()).toBe('order2');
      expect(fixture.nativeElement.querySelectorAll('.order-body').length).toBe(1);
    });

    it('shows item rows in the expanded body', () => {
      const order = mockOrder({
        items: [
          { product: 'p1', name: 'Eggs', price: 2.5, quantity: 3 },
          { product: 'p2', name: 'Milk', price: 1.2, quantity: 1 },
        ],
      });
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([order]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.item-row').length).toBe(2);
    });
  });
});
