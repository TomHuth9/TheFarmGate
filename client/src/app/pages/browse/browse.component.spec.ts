import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BrowseComponent } from './browse.component';
import { Product } from '../../models/product.model';
import { environment } from '../../../environments/environment';

const PRODUCTS_URL = `${environment.apiUrl}/products`;

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  _id: 'p1',
  name: 'Whole Milk',
  description: 'Fresh from the farm',
  price: 1.5,
  category: 'Dairy',
  imageUrl: '',
  unit: 'per litre',
  stock: 50,
  featured: false,
  ...overrides,
});

function setup() {
  TestBed.configureTestingModule({
    imports: [BrowseComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
  });
  const fixture = TestBed.createComponent(BrowseComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  return { fixture, component, httpMock };
}

describe('BrowseComponent', () => {
  describe('initial load', () => {
    it('fetches all products on init with no category', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();

      expect(component.loading()).toBeTrue();

      httpMock.expectOne(r => r.url === PRODUCTS_URL && !r.params.has('category')).flush([mockProduct()]);

      expect(component.loading()).toBeFalse();
      expect(component.products()).toHaveSize(1);
    });

    it('shows a spinner before the HTTP response arrives', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
    });

    it('shows the empty state when no products are returned', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('renders one card per product', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([
        mockProduct(),
        mockProduct({ _id: 'p2', name: 'Eggs', description: 'Laid by hens', category: 'Eggs' }),
      ]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('mat-card').length).toBe(2);
    });
  });

  describe('search input', () => {
    it('sends ?q param after debounce when the user types', fakeAsync(() => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);

      component.searchControl.setValue('eggs');
      tick(300);

      const req = httpMock.expectOne(r => r.url === PRODUCTS_URL && r.params.get('q') === 'eggs');
      expect(req.request.params.get('q')).toBe('eggs');
      req.flush([]);
      flush(); // drain any trailing Material timers
    }));

    it('does not fire a request before the debounce interval elapses', fakeAsync(() => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);

      component.searchControl.setValue('mil');
      tick(100);
      // no search request yet — only check that the signal is still showing the initial empty list
      expect(component.products()).toHaveSize(0);

      tick(200);
      // debounce has now elapsed; flush the resulting request
      httpMock.expectOne(r => r.url === PRODUCTS_URL && r.params.get('q') === 'mil').flush([]);
      flush(); // drain trailing timers
    }));

    it('omits ?q when the search is cleared', fakeAsync(() => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);

      component.searchControl.setValue('milk');
      tick(300);
      httpMock.expectOne(r => r.url === PRODUCTS_URL && r.params.has('q')).flush([]);

      component.searchControl.setValue('');
      tick(300);

      const req = httpMock.expectOne(r => r.url === PRODUCTS_URL);
      expect(req.request.params.has('q')).toBeFalse();
      req.flush([]);
      flush();
    }));

    it('does not fire a duplicate request for identical consecutive values', fakeAsync(() => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);

      component.searchControl.setValue('milk');
      tick(300);
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);

      // Same value again — distinctUntilChanged must block the second emission
      component.searchControl.setValue('milk');
      tick(300);
      expect(component.products()).toHaveSize(0); // signal unchanged — no second load
      httpMock.expectNone(r => r.url === PRODUCTS_URL);
      flush();
    }));

    it('shows a contextual empty-state message when search returns nothing', fakeAsync(() => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);

      component.searchControl.setValue('unicorn');
      tick(300);
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
      fixture.detectChanges();

      const msg: string = fixture.nativeElement.querySelector('.empty-state')?.textContent ?? '';
      expect(msg).toContain('unicorn');
      flush(); // drain any trailing Material form-field timers
    }));
  });

  describe('out-of-stock products', () => {
    it('applies the .oos-card class to a product card when stock is 0', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct({ stock: 0 })]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-card').classList).toContain('oos-card');
    });

    it('shows the out-of-stock label instead of the Add button when stock is 0', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct({ stock: 0 })]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.oos-label')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('button[color="primary"]')).toBeNull();
    });

    it('shows the Add button and no oos-label for an in-stock product', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct({ stock: 10 })]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('button[color="primary"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.oos-label')).toBeNull();
    });

    it('does not apply .oos-card to a card with stock remaining', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct({ stock: 5 })]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-card').classList).not.toContain('oos-card');
    });
  });

  describe('category selection', () => {
    it('appends the category param when a category is active', fakeAsync(() => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);

      component.activeCategory.set('Dairy');
      component['loadProducts']('Dairy', '');

      const req = httpMock.expectOne(r => r.url === PRODUCTS_URL && r.params.get('category') === 'Dairy');
      expect(req.request.params.get('category')).toBe('Dairy');
      req.flush([]);
      flush();
    }));

    it('resets the search term when the category changes', fakeAsync(() => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);

      component.searchControl.setValue('eggs');
      tick(300);
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);

      component.searchControl.setValue('', { emitEvent: false });
      expect(component.searchControl.value).toBe('');
      flush();
    }));
  });

  describe('sort', () => {
    const p1 = mockProduct({ _id: 'p1', name: 'Cheese', price: 5.0 });
    const p2 = mockProduct({ _id: 'p2', name: 'Apples', price: 2.0 });
    const p3 = mockProduct({ _id: 'p3', name: 'Milk',   price: 1.5 });

    it('displays products in the original server order by default', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([p1, p2, p3]);

      expect(component.displayProducts().map(p => p._id)).toEqual(['p1', 'p2', 'p3']);
    });

    it('sorts by price ascending when price-asc is selected', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([p1, p2, p3]);

      component.sort.set('price-asc');

      expect(component.displayProducts().map(p => p._id)).toEqual(['p3', 'p2', 'p1']);
    });

    it('sorts by price descending when price-desc is selected', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([p1, p2, p3]);

      component.sort.set('price-desc');

      expect(component.displayProducts().map(p => p._id)).toEqual(['p1', 'p2', 'p3']);
    });

    it('sorts alphabetically by name when name-asc is selected', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([p1, p2, p3]);

      component.sort.set('name-asc');

      // Apples → Cheese → Milk
      expect(component.displayProducts().map(p => p._id)).toEqual(['p2', 'p1', 'p3']);
    });

    it('resets sort to default when selectCategory() is called', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([p1]);

      component.sort.set('price-asc');
      component.selectCategory('All');

      expect(component.sort()).toBe('default');
    });
  });

  describe('farm name on product cards', () => {
    const productWithFarm = (): Product => ({
      ...mockProduct({ _id: 'pf1', name: 'Beef Mince' }),
      farm: { _id: 'farm1', farmName: 'Oak Ridge Organics' },
    });

    it('renders the farm name as a link when the product has a farm', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([productWithFarm()]);
      fixture.detectChanges();

      const link: HTMLElement = fixture.nativeElement.querySelector('.product-farm');
      expect(link).toBeTruthy();
      expect(link.textContent).toContain('Oak Ridge Organics');
    });

    it('does not show the farm link when the product has no farm', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([mockProduct()]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.product-farm')).toBeNull();
    });
  });

  describe('result count', () => {
    it('shows the count of displayed products', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([
        mockProduct(),
        mockProduct({ _id: 'p2', name: 'Eggs', description: 'Laid by hens', category: 'Eggs' }),
      ]);
      fixture.detectChanges();

      const count: HTMLElement = fixture.nativeElement.querySelector('.result-count');
      expect(count).toBeTruthy();
      expect(count.textContent).toContain('2');
    });

    it('hides the result count when there are no products', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(r => r.url === PRODUCTS_URL).flush([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.result-count')).toBeNull();
    });
  });
});
