import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { OrderConfirmationComponent } from './order-confirmation.component';
import { Order, OrderStatus } from '../../models/order.model';
import { environment } from '../../../environments/environment';

const ORDER_ID = 'order123';
const ORDER_URL = `${environment.apiUrl}/orders/${ORDER_ID}`;
const STATUS_URL = `${environment.apiUrl}/orders/${ORDER_ID}/status`;

const mockOrder = (overrides: Partial<Order> = {}): Order => ({
  _id: ORDER_ID,
  items: [
    { product: 'p1', name: 'Whole Milk', price: 1.5, quantity: 2 },
    { product: 'p2', name: 'Free-Range Eggs', price: 2.0, quantity: 1 },
  ],
  total: 5.0,
  status: 'pending',
  createdAt: '2026-08-01T12:00:00.000Z',
  deliveryAddress: { line1: '1 Farm Road', city: 'London', postcode: 'SW1 1AA' },
  ...overrides,
});

function setup() {
  TestBed.configureTestingModule({
    imports: [OrderConfirmationComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideNoopAnimations(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => ORDER_ID } } },
      },
    ],
  });

  const fixture = TestBed.createComponent(OrderConfirmationComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  return { fixture, component, httpMock };
}

describe('OrderConfirmationComponent', () => {
  describe('loading state', () => {
    it('shows a spinner before the order loads', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
    });

    it('hides the spinner after the order loads', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder());
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.order-hero')).toBeTruthy();
    });

    it('stops loading on HTTP error without throwing', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(
        { message: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );
      expect(component.loading()).toBeFalse();
      expect(component.order()).toBeNull();
    });
  });

  describe('ngOnInit()', () => {
    it('fetches the order using the route id param', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();

      expect(component.loading()).toBeTrue();

      const req = httpMock.expectOne(ORDER_URL);
      expect(req.request.method).toBe('GET');
      req.flush(mockOrder());

      expect(component.order()?._id).toBe(ORDER_ID);
      expect(component.loading()).toBeFalse();
    });
  });

  describe('status-aware header', () => {
    const cases: { status: OrderStatus; expected: string }[] = [
      { status: 'pending',    expected: 'Order Placed!' },
      { status: 'confirmed',  expected: 'Order Confirmed' },
      { status: 'dispatched', expected: 'On Its Way!' },
      { status: 'delivered',  expected: 'Order Delivered' },
      { status: 'cancelled',  expected: 'Order Cancelled' },
    ];

    for (const { status, expected } of cases) {
      it(`shows "${expected}" for ${status} orders`, () => {
        const { fixture, httpMock } = setup();
        fixture.detectChanges();
        httpMock.expectOne(ORDER_URL).flush(mockOrder({ status }));
        fixture.detectChanges();

        const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
        expect(h1.textContent!.trim()).toBe(expected);
      });
    }
  });

  describe('status tracker (stepper)', () => {
    it('shows the stepper for a pending order', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder({ status: 'pending' }));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.stepper')).toBeTruthy();
    });

    it('hides the stepper for cancelled orders', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder({ status: 'cancelled' }));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.stepper')).toBeNull();
    });

    it('renders 4 step nodes', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder());
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.step').length).toBe(4);
    });

    it('marks only the first step active and none done when pending', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder({ status: 'pending' }));
      fixture.detectChanges();

      const steps = fixture.nativeElement.querySelectorAll('.step');
      expect(steps[0].classList).toContain('step--active');
      expect(steps[0].classList).not.toContain('step--done');
      expect(steps[1].classList).not.toContain('step--active');
      expect(steps[1].classList).not.toContain('step--done');
    });

    it('marks steps before the current status as done', () => {
      // dispatched is index 2 → steps 0 and 1 done, step 2 active, step 3 neither
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder({ status: 'dispatched' }));
      fixture.detectChanges();

      const steps = fixture.nativeElement.querySelectorAll('.step');
      expect(steps[0].classList).toContain('step--done');
      expect(steps[1].classList).toContain('step--done');
      expect(steps[2].classList).toContain('step--active');
      expect(steps[3].classList).not.toContain('step--done');
      expect(steps[3].classList).not.toContain('step--active');
    });

    it('marks all prior steps done and the last step active when delivered', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder({ status: 'delivered' }));
      fixture.detectChanges();

      const steps = fixture.nativeElement.querySelectorAll('.step');
      expect(steps[0].classList).toContain('step--done');
      expect(steps[1].classList).toContain('step--done');
      expect(steps[2].classList).toContain('step--done');
      expect(steps[3].classList).toContain('step--active');
    });
  });

  describe('stepIndex()', () => {
    it('returns the correct index for each status', () => {
      const { component, httpMock, fixture } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder());

      expect(component.stepIndex('pending')).toBe(0);
      expect(component.stepIndex('confirmed')).toBe(1);
      expect(component.stepIndex('dispatched')).toBe(2);
      expect(component.stepIndex('delivered')).toBe(3);
      expect(component.stepIndex('cancelled')).toBe(-1);
    });
  });

  describe('delivery address', () => {
    it('shows the delivery address when present', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(
        mockOrder({ deliveryAddress: { line1: '10 Meadow Lane', city: 'Bristol', postcode: 'BS1 1AA' } }),
      );
      fixture.detectChanges();

      const address = fixture.nativeElement.querySelector('.delivery-address') as HTMLElement;
      expect(address).toBeTruthy();
      expect(address.textContent).toContain('10 Meadow Lane');
      expect(address.textContent).toContain('Bristol');
      expect(address.textContent).toContain('BS1 1AA');
    });

    it('hides the delivery address section when absent', () => {
      const order = mockOrder();
      delete order.deliveryAddress;
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(order);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.delivery-address')).toBeNull();
    });
  });

  describe('cancel order', () => {
    it('shows the cancel button for a pending order', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder({ status: 'pending' }));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button[color="warn"]')).toBeTruthy();
    });

    it('hides the cancel button for a non-pending order', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder({ status: 'confirmed' }));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('button[color="warn"]')).toBeNull();
    });

    it('sends a PATCH request and updates the order on confirmation', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder());
      fixture.detectChanges();

      spyOn(window, 'confirm').and.returnValue(true);
      component.cancelOrder();

      const req = httpMock.expectOne(STATUS_URL);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'cancelled' });
      req.flush(mockOrder({ status: 'cancelled' }));

      expect(component.order()?.status).toBe('cancelled');
    });

    it('does not send a request when the confirm dialog is dismissed', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder());

      spyOn(window, 'confirm').and.returnValue(false);
      component.cancelOrder();

      httpMock.expectNone(STATUS_URL);
    });

    it('sets cancelling to true while the request is in flight and false on completion', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder());

      spyOn(window, 'confirm').and.returnValue(true);
      component.cancelOrder();

      expect(component.cancelling()).toBeTrue();

      httpMock.expectOne(STATUS_URL).flush(mockOrder({ status: 'cancelled' }));

      expect(component.cancelling()).toBeFalse();
    });
  });

  describe('navigation', () => {
    it('includes a back link to My Orders', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder());
      fixture.detectChanges();

      const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
      expect(links.some((a) => a.textContent!.includes('My Orders'))).toBeTrue();
    });

    it('includes a Continue Shopping link', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(ORDER_URL).flush(mockOrder());
      fixture.detectChanges();

      const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
      expect(links.some((a) => a.textContent!.includes('Continue Shopping'))).toBeTrue();
    });
  });
});
