import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ProductDetailComponent } from './product-detail.component';
import { Product } from '../../models/product.model';
import { environment } from '../../../environments/environment';

const PRODUCT_URL = `${environment.apiUrl}/products/prod1`;

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  _id: 'prod1',
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

function setup() {
  TestBed.configureTestingModule({
    imports: [ProductDetailComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideNoopAnimations(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => 'prod1' } } },
      },
    ],
  });

  const fixture = TestBed.createComponent(ProductDetailComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  return { fixture, component, httpMock };
}

describe('ProductDetailComponent', () => {
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
  });

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

    it('sets added() to true immediately after adding', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(PRODUCT_URL).flush(mockProduct());

      spyOn(component.basket, 'add');
      component.addToBasket();

      expect(component.added()).toBeTrue();
    });
  });

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
  });
});
