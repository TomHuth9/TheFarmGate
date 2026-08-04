import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ProductDetailComponent } from './product-detail.component';
import { Product } from '../../models/product.model';
import { Review, ReviewPage } from '../../models/review.model';
import { BasketService } from '../../services/basket.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

const PRODUCT_ID = 'prod1';
const FARM_ID = 'farm1';
const PRODUCT_URL = `${environment.apiUrl}/products/${PRODUCT_ID}`;
const PRODUCTS_API = `${environment.apiUrl}/products`;
const REVIEWS_URL  = `${environment.apiUrl}/products/${PRODUCT_ID}/reviews`;

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  _id: PRODUCT_ID,
  name: 'Organic Milk',
  description: 'Rich and creamy',
  price: 1.5,
  category: 'Dairy',
  imageUrl: 'https://example.com/milk.jpg',
  unit: 'per litre',
  stock: 20,
  featured: false,
  ...overrides,
});

const withFarm = (overrides: Partial<Product> = {}): Product =>
  mockProduct({
    farm: { _id: FARM_ID, farmName: 'Green Pastures Farm', farmLocation: 'Devon' },
    ...overrides,
  });

function setup() {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [ProductDetailComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideNoopAnimations(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => PRODUCT_ID } } },
      },
    ],
  });

  const fixture = TestBed.createComponent(ProductDetailComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  const basket = TestBed.inject(BasketService);
  return { fixture, component, httpMock, basket };
}

const flushRelated = (httpMock: HttpTestingController, related: Product[] = []) =>
  httpMock
    .expectOne((req) => req.url === PRODUCTS_API && req.params.get('farm') === FARM_ID)
    .flush(related);

describe('ProductDetailComponent', () => {
  afterEach(() => localStorage.clear());

  // ── Initial load ─────────────────────────────────────────────────────────────
  describe('initial load', () => {
    it('shows a spinner while the product is loading', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();

      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());
    });

    it('renders the product name after the response arrives', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ name: 'Organic Milk' }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Organic Milk');
    });

    it('stops loading and hides the spinner after the response arrives', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());
      httpMock.expectOne((r) => r.url === REVIEWS_URL).flush({ reviews: [], total: 0, page: 1, pages: 0, avgRating: null, count: 0 });
      fixture.detectChanges();

      expect(component.loading()).toBeFalse();
      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeNull();
    });

    it('stops loading without throwing when the request errors', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock
        .expectOne(PRODUCT_URL)
        .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

      expect(component.loading()).toBeFalse();
      expect(component.product()).toBeNull();
    });

    it('shows "Product not found" message on error', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock
        .expectOne(PRODUCT_URL)
        .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });
  });

  // ── Farm link ─────────────────────────────────────────────────────────────────
  describe('farm link', () => {
    it('shows the farm name and location when a farm is present', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(withFarm());
      flushRelated(httpMock);
      fixture.detectChanges();

      const link = fixture.nativeElement.querySelector('.farm-link') as HTMLElement;
      expect(link).toBeTruthy();
      expect(link.textContent).toContain('Green Pastures Farm');
      expect(link.textContent).toContain('Devon');
    });

    it('hides the farm link when no farm is attached', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ farm: null }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.farm-link')).toBeNull();
    });
  });

  // ── Out-of-stock ─────────────────────────────────────────────────────────────
  describe('out-of-stock product', () => {
    it('shows the out-of-stock notice when stock is 0', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ stock: 0 }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.oos-notice')).toBeTruthy();
    });

    it('does not render the Add to Basket button when stock is 0', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ stock: 0 }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.add-btn')).toBeNull();
    });

    it('shows the Add to Basket button and no oos-notice for an in-stock product', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ stock: 10 }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.add-btn')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.oos-notice')).toBeNull();
    });
  });

  // ── Qty stepper ───────────────────────────────────────────────────────────────
  describe('changeQty()', () => {
    it('does not decrease quantity below 1', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());

      component.changeQty(-1);

      expect(component.quantity()).toBe(1);
    });

    it('increments and decrements the quantity correctly', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());

      component.changeQty(1);
      component.changeQty(1);
      expect(component.quantity()).toBe(3);

      component.changeQty(-1);
      expect(component.quantity()).toBe(2);
    });

    it('caps quantity at product.stock', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ stock: 3 }));

      component.changeQty(1);
      component.changeQty(1);
      component.changeQty(1); // would push to 4 without cap
      component.changeQty(1);
      expect(component.quantity()).toBe(3);
    });

    it('disables the − button when quantity is 1', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.qty-controls button');
      expect(buttons[0].disabled).toBeTrue();
    });

    it('disables the + button when quantity equals stock', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ stock: 2 }));
      fixture.detectChanges();

      component.changeQty(1); // qty = 2 = stock
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.qty-controls button');
      expect(buttons[1].disabled).toBeTrue();
    });
  });

  // ── Add to basket ─────────────────────────────────────────────────────────────
  describe('addToBasket()', () => {
    it('calls basket.add() with the loaded product and current quantity', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      const product = mockProduct();
      httpMock.expectOne(PRODUCT_URL).flush(product);

      spyOn(component.basket, 'add');
      component.addToBasket();

      expect(component.basket.add).toHaveBeenCalledWith(product, 1);
    });

    it('passes the selected quantity to basket.add()', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      const product = mockProduct();
      httpMock.expectOne(PRODUCT_URL).flush(product);

      spyOn(component.basket, 'add');
      component.changeQty(1); // qty = 2
      component.addToBasket();

      expect(component.basket.add).toHaveBeenCalledWith(product, 2);
    });

    it('sets added() to true immediately after adding', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());

      spyOn(component.basket, 'add');
      component.addToBasket();

      expect(component.added()).toBeTrue();
    });

    it('resets added() to false after 2 seconds', fakeAsync(() => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());

      spyOn(component.basket, 'add');
      component.addToBasket();
      expect(component.added()).toBeTrue();

      tick(2000);
      expect(component.added()).toBeFalse();
    }));
  });

  // ── Basket indicator ──────────────────────────────────────────────────────────
  describe('basketQty', () => {
    it('returns 0 when the product is not in the basket', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());
      expect(component.basketQty()).toBe(0);
    });

    it('returns the correct quantity when the product is already in the basket', () => {
      const { fixture, component, httpMock, basket } = setup();
      fixture.detectChanges();
      const p = mockProduct();
      httpMock.expectOne(PRODUCT_URL).flush(p);

      basket.add(p, 3);
      expect(component.basketQty()).toBe(3);
    });

    it('shows the basket notice when basketQty is greater than 0', () => {
      const { fixture, httpMock, basket } = setup();
      fixture.detectChanges();
      const p = mockProduct();
      httpMock.expectOne(PRODUCT_URL).flush(p);
      fixture.detectChanges();

      basket.add(p, 2);
      fixture.detectChanges();

      const notice = fixture.nativeElement.querySelector('.basket-notice') as HTMLElement;
      expect(notice).toBeTruthy();
      expect(notice.textContent).toContain('2');
    });

    it('hides the basket notice when the basket is empty', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.basket-notice')).toBeNull();
    });

    it('shows "item" (singular) when basketQty is 1', () => {
      const { fixture, httpMock, basket } = setup();
      fixture.detectChanges();
      const p = mockProduct();
      httpMock.expectOne(PRODUCT_URL).flush(p);
      fixture.detectChanges();

      basket.add(p, 1);
      fixture.detectChanges();

      const notice = fixture.nativeElement.querySelector('.basket-notice') as HTMLElement;
      expect(notice.textContent).toContain('1 item already');
      expect(notice.textContent).not.toContain('items');
    });
  });

  // ── Reviews ───────────────────────────────────────────────────────────────────
  describe('reviews', () => {
    const CUSTOMER = { id: 'u1', name: 'Alice', email: 'alice@ex.com', role: 'customer' as const };

    const emptyPage = (): ReviewPage => ({
      reviews: [], total: 0, page: 1, pages: 0, avgRating: null, count: 0,
    });

    const oneReview = (): Review => ({
      _id: 'r1',
      product: PRODUCT_ID,
      user: { _id: 'u1', name: 'Alice' },
      rating: 4,
      body: 'Really good milk.',
      createdAt: new Date().toISOString(),
    });

    const filledPage = (): ReviewPage => ({
      reviews: [oneReview()],
      total: 1, page: 1, pages: 1, avgRating: 4, count: 1,
    });

    // Flush product (no farm) then reviews — the minimal setup for review tests
    function flushNoFarm(httpMock: HttpTestingController, reviewPage: ReviewPage = emptyPage()) {
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ farm: null }));
      httpMock.expectOne((r) => r.url === REVIEWS_URL).flush(reviewPage);
    }

    it('fires GET reviews after the product loads', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ farm: null }));

      const req = httpMock.expectOne((r) => r.url === REVIEWS_URL && r.params.get('page') === '1');
      expect(req.request.method).toBe('GET');
      req.flush(emptyPage());
    });

    it('sets reviewPage signal after reviews load', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock, filledPage());

      expect(component.reviewPage()?.count).toBe(1);
      expect(component.reviewPage()?.avgRating).toBe(4);
    });

    it('renders review cards for each review in the page', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock, filledPage());
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.review-card');
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('Really good milk.');
      expect(cards[0].textContent).toContain('Alice');
    });

    it('shows the aggregate rating when count > 0', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock, filledPage());
      fixture.detectChanges();

      const aggregate = fixture.nativeElement.querySelector('.reviews-aggregate') as HTMLElement;
      expect(aggregate).toBeTruthy();
      expect(aggregate.textContent).toContain('4');
    });

    it('hides the write-review form for unauthenticated users', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.write-review')).toBeNull();
    });

    it('shows the write-review form for authenticated customers', () => {
      const { fixture, httpMock } = setup();
      TestBed.inject(AuthService).currentUser.set(CUSTOMER);
      fixture.detectChanges();
      flushNoFarm(httpMock);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.write-review')).toBeTruthy();
    });

    it('setRating() updates pendingRating and the form control', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock);

      component.setRating(3);

      expect(component.pendingRating()).toBe(3);
      expect(component.reviewForm.value.rating).toBe(3);
    });

    it('submitReview() posts to the reviews endpoint', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock);

      component.setRating(5);
      component.reviewForm.patchValue({ body: 'Superb!' });
      component.submitReview();

      const req = httpMock.expectOne((r) => r.url === REVIEWS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(jasmine.objectContaining({ rating: 5, body: 'Superb!' }));
      req.flush(oneReview());
    });

    it('submitReview() prepends the new review and updates the aggregate', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock, emptyPage());

      component.setRating(5);
      component.submitReview();

      httpMock.expectOne((r) => r.url === REVIEWS_URL).flush(oneReview());

      expect(component.reviewPage()?.count).toBe(1);
      expect(component.reviewPage()?.reviews[0]._id).toBe('r1');
    });

    it('submitReview() sets reviewSuccess and hasReviewed to true on success', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock);

      component.setRating(4);
      component.submitReview();
      httpMock.expectOne((r) => r.url === REVIEWS_URL).flush(oneReview());

      expect(component.reviewSuccess()).toBeTrue();
      expect(component.hasReviewed()).toBeTrue();
    });

    it('submitReview() sets reviewError on failure', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock);

      component.setRating(4);
      component.submitReview();
      httpMock.expectOne((r) => r.url === REVIEWS_URL).flush(
        { message: 'Server error' },
        { status: 500, statusText: 'Internal Server Error' },
      );

      expect(component.reviewError()).toBe('Server error');
      expect(component.submitting()).toBeFalse();
    });

    it('submitReview() sets hasReviewed on a 409 conflict response', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock);

      component.setRating(4);
      component.submitReview();
      httpMock.expectOne((r) => r.url === REVIEWS_URL).flush(
        { message: 'You have already reviewed this product.' },
        { status: 409, statusText: 'Conflict' },
      );

      expect(component.hasReviewed()).toBeTrue();
      expect(component.submitting()).toBeFalse();
    });

    it('submitReview() is blocked when rating is 0 (form invalid)', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushNoFarm(httpMock);

      // rating stays 0 — form is invalid
      component.submitReview();

      httpMock.expectNone((r) => r.url === REVIEWS_URL);
    });
  });

  // ── Related products ──────────────────────────────────────────────────────────
  describe('related products ("More from this farm")', () => {
    const relatedProduct = (id = 'prod2'): Product => ({
      _id: id,
      name: 'Skimmed Milk',
      description: 'Low fat.',
      price: 1.2,
      category: 'Dairy',
      imageUrl: '',
      unit: 'per litre',
      stock: 5,
      featured: false,
      farm: { _id: FARM_ID, farmName: 'Green Pastures Farm' },
    });

    it('fires a second request filtered by farm when the product has a farm', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(withFarm());

      const req = httpMock.expectOne(
        (r) => r.url === PRODUCTS_API && r.params.get('farm') === FARM_ID,
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('does not fire a related request when the product has no farm', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct({ farm: null }));
      httpMock.expectNone((r) => r.url === PRODUCTS_API && r.params.has('farm'));
    });

    it('renders one card per related product', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(withFarm());
      flushRelated(httpMock, [relatedProduct('p2'), relatedProduct('p3')]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.related-card').length).toBe(2);
    });

    it('excludes the current product from the related list', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(withFarm());
      // API returns current product + one other
      flushRelated(httpMock, [withFarm(), relatedProduct()]);

      expect(component.relatedProducts()).toHaveSize(1);
      expect(component.relatedProducts()[0]._id).not.toBe(PRODUCT_ID);
    });

    it('caps the related list at 4', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(withFarm());
      const many = Array.from({ length: 6 }, (_, i) => relatedProduct(`extra${i}`));
      flushRelated(httpMock, many);

      expect(component.relatedProducts()).toHaveSize(4);
    });

    it('hides the related section when there are no other products from the farm', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(withFarm());
      flushRelated(httpMock, []);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.related-section')).toBeNull();
    });
  });
});
