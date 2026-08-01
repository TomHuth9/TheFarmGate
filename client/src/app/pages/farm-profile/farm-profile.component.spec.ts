import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { FarmProfileComponent } from './farm-profile.component';
import { Farm } from '../../models/user.model';
import { Product } from '../../models/product.model';
import { environment } from '../../../environments/environment';

const FARMS_URL = `${environment.apiUrl}/farms`;

const mockFarm = (): Farm => ({
  _id: 'farm1',
  name: 'Green Acres',
  farmName: 'Green Acres',
  farmDescription: 'A lovely farm',
  farmLocation: 'Yorkshire, UK',
});

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  _id: 'p1',
  name: 'Organic Milk',
  description: 'Rich and creamy milk from grass-fed cows',
  price: 1.5,
  category: 'Dairy',
  imageUrl: '',
  unit: 'per litre',
  stock: 50,
  featured: false,
  farmFeatured: false,
  ...overrides,
});

function setup(farmId = 'farm1') {
  TestBed.configureTestingModule({
    imports: [FarmProfileComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideNoopAnimations(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => farmId } } },
      },
    ],
  });

  const fixture = TestBed.createComponent(FarmProfileComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  return { fixture, component, httpMock };
}

function flushProfile(httpMock: HttpTestingController, farm = mockFarm(), products: Product[] = []) {
  httpMock.expectOne(`${FARMS_URL}/farm1`).flush({ farm, products });
}

describe('FarmProfileComponent', () => {
  describe('initial load', () => {
    it('fetches the farm profile on init', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();

      expect(component.loading()).toBeTrue();

      flushProfile(httpMock, mockFarm(), [mockProduct()]);

      expect(component.loading()).toBeFalse();
      expect(component.farm()).toBeTruthy();
      expect(component.products()).toHaveSize(1);
    });

    it('shows a spinner while loading', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
      flushProfile(httpMock);
    });

    it('shows the empty state when the farm has no products', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), []);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('renders the farm name in the hero', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), []);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Green Acres');
    });
  });

  describe('filteredProducts()', () => {
    it('returns all products when the search term is empty', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), [mockProduct(), mockProduct({ _id: 'p2', name: 'Free Range Eggs', category: 'Eggs' as const })]);

      expect(component.filteredProducts()).toHaveSize(2);
    });

    it('filters by name (case-insensitive)', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), [
        mockProduct({ _id: 'p1', name: 'Organic Milk' }),
        mockProduct({ _id: 'p2', name: 'Free Range Eggs', description: 'Laid by hens', category: 'Eggs' as const }),
      ]);

      component.searchControl.setValue('milk');
      fixture.detectChanges();

      expect(component.filteredProducts()).toHaveSize(1);
      expect(component.filteredProducts()[0].name).toBe('Organic Milk');
    });

    it('filters by description keyword', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), [
        mockProduct({ _id: 'p1', name: 'Milk', description: 'From grass-fed cows' }),
        mockProduct({ _id: 'p2', name: 'Steak', description: 'Also from grass-fed cows', category: 'Beef' as const }),
        mockProduct({ _id: 'p3', name: 'Eggs', description: 'Laid daily', category: 'Eggs' as const }),
      ]);

      component.searchControl.setValue('grass-fed');

      expect(component.filteredProducts()).toHaveSize(2);
    });

    it('returns an empty array when nothing matches the search', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), [mockProduct()]);

      component.searchControl.setValue('unicorn');

      expect(component.filteredProducts()).toHaveSize(0);
    });

    it('returns all products again when the search is cleared', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), [
        mockProduct({ _id: 'p1', name: 'Organic Milk' }),
        mockProduct({ _id: 'p2', name: 'Eggs', description: 'Laid by hens', category: 'Eggs' as const }),
      ]);

      component.searchControl.setValue('milk');
      expect(component.filteredProducts()).toHaveSize(1);

      component.searchControl.setValue('');
      expect(component.filteredProducts()).toHaveSize(2);
    });

    it('matches partial name fragments', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), [mockProduct({ name: 'Organic Whole Milk' })]);

      component.searchControl.setValue('whol');

      expect(component.filteredProducts()).toHaveSize(1);
    });
  });

  describe('rendering during search', () => {
    it('shows filtered products in the DOM', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), [
        mockProduct({ _id: 'p1', name: 'Milk' }),
        mockProduct({ _id: 'p2', name: 'Eggs', description: 'Laid by hens', category: 'Eggs' as const }),
      ]);
      fixture.detectChanges();

      component.searchControl.setValue('eggs');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('mat-card').length).toBe(1);
    });

    it('shows a no-match message when filtered list is empty', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), [mockProduct()]);
      fixture.detectChanges();

      component.searchControl.setValue('unicorn');
      fixture.detectChanges();

      const msg: string = fixture.nativeElement.querySelector('.empty-state')?.textContent ?? '';
      expect(msg).toContain('unicorn');
    });

    it('hides the highlights strip while a search is active', () => {
      const featured = mockProduct({ _id: 'pf', farmFeatured: true });
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      flushProfile(httpMock, mockFarm(), [featured]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.featured-strip')).toBeTruthy();

      component.searchControl.setValue('anything');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.featured-strip')).toBeNull();
    });
  });
});
