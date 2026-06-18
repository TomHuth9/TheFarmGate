import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CheckoutComponent } from './checkout.component';
import { BasketService } from '../../services/basket.service';
import { Product } from '../../models/product.model';
import { environment } from '../../../environments/environment';

const ORDERS_URL = `${environment.apiUrl}/orders`;

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  _id: 'prod1',
  name: 'Milk',
  description: 'Fresh',
  price: 1.50,
  category: 'Dairy',
  imageUrl: '',
  unit: 'per litre',
  stock: 10,
  featured: false,
  ...overrides,
});

const STORED_USER = JSON.stringify({ id: '1', name: 'Alice', email: 'alice@example.com', role: 'customer' });

// ─── Unauthenticated ──────────────────────────────────────────────────────────

describe('CheckoutComponent (unauthenticated)', () => {
  let fixture: ComponentFixture<CheckoutComponent>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('renders the login prompt', () => {
    expect(fixture.nativeElement.querySelector('.login-prompt')).toBeTruthy();
  });

  it('does not render the address form', () => {
    expect(fixture.nativeElement.querySelector('.address-form')).toBeNull();
  });
});

// ─── Authenticated ────────────────────────────────────────────────────────────

describe('CheckoutComponent (authenticated)', () => {
  let fixture: ComponentFixture<CheckoutComponent>;
  let component: CheckoutComponent;
  let basketService: BasketService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.setItem('tfg_user', STORED_USER);

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    basketService = TestBed.inject(BasketService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('renders the address form and not the login prompt', () => {
    expect(fixture.nativeElement.querySelector('.address-form')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.login-prompt')).toBeNull();
  });

  describe('submit()', () => {
    it('is a no-op when the form is invalid', () => {
      // form starts invalid (required fields empty)
      component.submit();
      expect(component.submitting()).toBeFalse();
      httpMock.expectNone(ORDERS_URL);
    });

    it('is a no-op when the basket is empty even with a valid form', () => {
      component.form.setValue({ line1: '1 Farm Rd', line2: '', city: 'London', postcode: 'SW1 1AA', notes: '' });
      component.submit();
      expect(component.submitting()).toBeFalse();
      httpMock.expectNone(ORDERS_URL);
    });

    it('sets submitting to true immediately after being called', () => {
      basketService.add(mockProduct());
      component.form.setValue({ line1: '1 Farm Rd', line2: '', city: 'London', postcode: 'SW1 1AA', notes: '' });
      spyOn(router, 'navigate');

      component.submit();

      expect(component.submitting()).toBeTrue();
      httpMock.expectOne(ORDERS_URL).flush({ _id: 'order1', status: 'pending', items: [], total: 1.50, createdAt: '' });
    });

    it('sends a POST to /api/orders with the delivery address and basket items', () => {
      basketService.add(mockProduct());
      component.form.setValue({ line1: '1 Farm Rd', line2: 'Apt 2', city: 'London', postcode: 'SW1 1AA', notes: 'Leave at door' });

      component.submit();

      const req = httpMock.expectOne(ORDERS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.deliveryAddress.line1).toBe('1 Farm Rd');
      expect(req.request.body.deliveryAddress.city).toBe('London');
      expect(req.request.body.items[0].product).toBe('prod1');
      expect(req.request.body.notes).toBe('Leave at door');
      req.flush({ _id: 'order1', status: 'pending', items: [], total: 1.50, createdAt: '' });
    });

    it('clears the basket and navigates to order confirmation on success', () => {
      basketService.add(mockProduct());
      component.form.setValue({ line1: '1 Farm Rd', line2: '', city: 'London', postcode: 'SW1 1AA', notes: '' });
      spyOn(router, 'navigate');

      component.submit();
      httpMock.expectOne(ORDERS_URL).flush({ _id: 'order123', status: 'pending', items: [], total: 1.50, createdAt: '' });

      expect(basketService.items()).toHaveSize(0);
      expect(router.navigate).toHaveBeenCalledWith(['/order-confirmation', 'order123']);
    });

    it('sets the error signal and clears submitting on failure', () => {
      basketService.add(mockProduct());
      component.form.setValue({ line1: '1 Farm Rd', line2: '', city: 'London', postcode: 'SW1 1AA', notes: '' });

      component.submit();
      httpMock
        .expectOne(ORDERS_URL)
        .flush({ message: 'Could not place order' }, { status: 400, statusText: 'Bad Request' });

      expect(component.error()).toBeTruthy();
      expect(component.submitting()).toBeFalse();
    });
  });
});
