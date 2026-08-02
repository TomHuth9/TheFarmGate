import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MyOrdersComponent } from './my-orders.component';
import { Order, StatusHistoryEntry } from '../../models/order.model';
import { environment } from '../../../environments/environment';

const MY_ORDERS_URL = `${environment.apiUrl}/orders/my`;
const statusUrl = (id: string) => `${environment.apiUrl}/orders/${id}/status`;
const productUrl = (id: string) => `${environment.apiUrl}/products/${id}`;

const CUSTOMER = JSON.stringify({ id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'customer' });

const T0 = '2026-01-01T10:00:00.000Z';
const T1 = '2026-01-01T11:00:00.000Z';

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

    it('shows the delivery address when expanded and an address is present', () => {
      const order = mockOrder({
        deliveryAddress: { line1: '5 Green Lane', city: 'Bath', postcode: 'BA1 1AA' },
      });
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([order]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      const address = fixture.nativeElement.querySelector('.delivery-address') as HTMLElement;
      expect(address).toBeTruthy();
      expect(address.textContent).toContain('5 Green Lane');
      expect(address.textContent).toContain('Bath');
    });

    it('hides the delivery address row when no address is present', () => {
      const order = mockOrder();
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([order]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.delivery-address')).toBeNull();
    });
  });

  describe('cancelOrder()', () => {
    it('shows the cancel button for a pending order when expanded', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder({ status: 'pending' })]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('button[color="warn"]')).toBeTruthy();
    });

    it('does not show the cancel button for a non-pending order', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder({ status: 'confirmed' })]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('button[color="warn"]')).toBeNull();
    });

    it('sends a PATCH request with status cancelled', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder()]);
      fixture.detectChanges();

      spyOn(window, 'confirm').and.returnValue(true);
      component.cancelOrder('order1');

      const req = httpMock.expectOne(statusUrl('order1'));
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'cancelled' });
      req.flush(mockOrder({ status: 'cancelled' }));
    });

    it('updates the order status in the list after a successful cancellation', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder()]);
      fixture.detectChanges();

      spyOn(window, 'confirm').and.returnValue(true);
      component.cancelOrder('order1');
      httpMock.expectOne(statusUrl('order1')).flush(mockOrder({ status: 'cancelled' }));

      expect(component.orders()[0].status).toBe('cancelled');
    });

    it('sets cancellingId while the request is in flight and clears it on completion', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder()]);

      spyOn(window, 'confirm').and.returnValue(true);
      component.cancelOrder('order1');

      expect(component.cancellingId()).toBe('order1');

      httpMock.expectOne(statusUrl('order1')).flush(mockOrder({ status: 'cancelled' }));

      expect(component.cancellingId()).toBeNull();
    });

    it('does not send a request when the confirm dialog is dismissed', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder()]);

      spyOn(window, 'confirm').and.returnValue(false);
      component.cancelOrder('order1');

      httpMock.expectNone(statusUrl('order1'));
    });
  });

  describe('timelineSteps()', () => {
    it('returns the four normal steps for a non-cancelled order', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      const order = mockOrder({
        status: 'confirmed',
        statusHistory: [
          { status: 'pending', changedAt: T0 },
          { status: 'confirmed', changedAt: T1 },
        ],
      });

      const steps = component.timelineSteps(order);
      expect(steps.map(s => s.status)).toEqual(['pending', 'confirmed', 'dispatched', 'delivered']);
    });

    it('marks steps with a history entry as reached', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      const order = mockOrder({
        status: 'confirmed',
        statusHistory: [
          { status: 'pending', changedAt: T0 },
          { status: 'confirmed', changedAt: T1 },
        ],
      });

      const steps = component.timelineSteps(order);
      expect(steps[0].reached).toBeTrue();   // pending
      expect(steps[1].reached).toBeTrue();   // confirmed
      expect(steps[2].reached).toBeFalse();  // dispatched
      expect(steps[3].reached).toBeFalse();  // delivered
    });

    it('exposes changedAt on reached steps and null on unreached steps', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      const order = mockOrder({
        status: 'pending',
        statusHistory: [{ status: 'pending', changedAt: T0 }],
      });

      const steps = component.timelineSteps(order);
      expect(steps[0].changedAt).toBe(T0);
      expect(steps[1].changedAt).toBeNull();
    });

    it('appends a cancelled step and stops the normal flow for a cancelled order', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      const order = mockOrder({
        status: 'cancelled',
        statusHistory: [
          { status: 'pending', changedAt: T0 },
          { status: 'cancelled', changedAt: T1 },
        ],
      });

      const steps = component.timelineSteps(order);
      expect(steps.length).toBe(2);
      expect(steps[0].status).toBe('pending');
      expect(steps[1].status).toBe('cancelled');
      expect(steps[1].reached).toBeTrue();
    });

    it('handles an order with no statusHistory gracefully', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      const steps = component.timelineSteps(mockOrder());
      expect(steps.length).toBe(4);
      steps.forEach(s => expect(s.reached).toBeFalse());
    });
  });

  describe('timeline DOM', () => {
    it('renders .order-timeline when statusHistory is present', () => {
      const order = mockOrder({
        status: 'confirmed',
        statusHistory: [
          { status: 'pending', changedAt: T0 },
          { status: 'confirmed', changedAt: T1 },
        ],
      });
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([order]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.order-timeline')).toBeTruthy();
    });

    it('does not render .order-timeline when statusHistory is absent', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder()]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.order-timeline')).toBeNull();
    });

    it('marks the correct number of .timeline-step.reached elements', () => {
      const order = mockOrder({
        status: 'dispatched',
        statusHistory: [
          { status: 'pending', changedAt: T0 },
          { status: 'confirmed', changedAt: T1 },
          { status: 'dispatched', changedAt: '2026-01-01T12:00:00.000Z' },
        ],
      });
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([order]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.timeline-step.reached').length).toBe(3);
    });
  });

  describe('reorder button', () => {
    it('shows the reorder button only for a delivered order', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder({ status: 'delivered' })]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      const btns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
      expect(Array.from(btns).some(b => b.textContent?.includes('Reorder'))).toBeTrue();
    });

    it('does not show the reorder button for a non-delivered order', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([mockOrder({ status: 'confirmed' })]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.order-header').click();
      fixture.detectChanges();

      const btns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
      expect(Array.from(btns).some(b => b.textContent?.includes('Reorder'))).toBeFalse();
    });

    it('sets reorderingId while requests are in flight and clears it after', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      component.reorder(mockOrder());
      expect(component.reorderingId()).toBe('order1');

      httpMock.expectOne(productUrl('prod1')).flush({ _id: 'prod1', name: 'Milk', price: 1.5, stock: 10 });
      expect(component.reorderingId()).toBeNull();
    });

    it('adds in-stock products to the basket and reports them in reorderResult.added', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      component.reorder(mockOrder());
      httpMock.expectOne(productUrl('prod1')).flush({ _id: 'prod1', name: 'Milk', price: 1.5, stock: 10 });

      expect(component.reorderResult()?.added).toContain('Milk');
      expect(component.reorderResult()?.outOfStock).toHaveSize(0);
    });

    it('reports out-of-stock products without adding them to the basket', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      component.reorder(mockOrder());
      httpMock.expectOne(productUrl('prod1')).flush({ _id: 'prod1', name: 'Milk', price: 1.5, stock: 0 });

      expect(component.reorderResult()?.outOfStock).toContain('Milk');
      expect(component.reorderResult()?.added).toHaveSize(0);
    });

    it('splits a multi-item order between added and outOfStock', () => {
      const order = mockOrder({
        items: [
          { product: 'p1', name: 'Eggs', price: 2.5, quantity: 1 },
          { product: 'p2', name: 'Milk', price: 1.5, quantity: 2 },
        ],
      });
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      component.reorder(order);
      httpMock.expectOne(productUrl('p1')).flush({ _id: 'p1', name: 'Eggs', price: 2.5, stock: 0 });
      httpMock.expectOne(productUrl('p2')).flush({ _id: 'p2', name: 'Milk', price: 1.5, stock: 5 });

      expect(component.reorderResult()?.added).toContain('Milk');
      expect(component.reorderResult()?.outOfStock).toContain('Eggs');
    });

    it('sets orderId on reorderResult so the message appears under the right order', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne(MY_ORDERS_URL).flush([]);

      component.reorder(mockOrder());
      httpMock.expectOne(productUrl('prod1')).flush({ _id: 'prod1', name: 'Milk', price: 1.5, stock: 5 });

      expect(component.reorderResult()?.orderId).toBe('order1');
    });
  });
});
