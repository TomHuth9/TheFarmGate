import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HomeComponent } from './home.component';
import { Product } from '../../models/product.model';
import { Farm } from '../../models/user.model';
import { environment } from '../../../environments/environment';

const PRODUCTS_URL = `${environment.apiUrl}/products`;
const FARMS_URL    = `${environment.apiUrl}/farms`;

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  _id: 'p1',
  name: 'Whole Milk',
  description: 'Fresh from the farm',
  price: 1.5,
  category: 'Dairy',
  imageUrl: '',
  unit: 'per litre',
  stock: 50,
  featured: true,
  ...overrides,
});

const mockFarm = (overrides: Partial<Farm> = {}): Farm => ({
  _id: 'f1',
  name: 'Meadow View',
  farmName: 'Meadow View Farm',
  farmDescription: 'Beautiful upland grazing in Shropshire.',
  farmLocation: 'Shropshire, UK',
  ...overrides,
});

function setup() {
  TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
  });
  const fixture = TestBed.createComponent(HomeComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  return { fixture, component, httpMock };
}

function flushAll(
  httpMock: HttpTestingController,
  { products = [] as Product[], farms = [] as Farm[] } = {},
) {
  httpMock.expectOne((r) => r.url === PRODUCTS_URL && r.params.get('featured') === 'true').flush(products);
  httpMock.expectOne(FARMS_URL).flush(farms);
}

describe('HomeComponent', () => {
  describe('ngOnInit()', () => {
    it('fires two requests on init: featured products and farms', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();

      httpMock.expectOne((r) => r.url === PRODUCTS_URL && r.params.get('featured') === 'true').flush([]);
      httpMock.expectOne(FARMS_URL).flush([]);
    });

    it('populates the featured signal from the products response', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();

      flushAll(httpMock, { products: [mockProduct()] });

      expect(component.featured()).toHaveSize(1);
    });

    it('populates the farms signal from the farms response', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();

      flushAll(httpMock, { farms: [mockFarm(), mockFarm({ _id: 'f2', farmName: 'Oak Ridge' })] });

      expect(component.farms()).toHaveSize(2);
    });

    it('caps the farms signal at 3 even when more farms are returned', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();

      const manyFarms = ['f1', 'f2', 'f3', 'f4', 'f5'].map((_id) => mockFarm({ _id }));
      flushAll(httpMock, { farms: manyFarms });

      expect(component.farms()).toHaveSize(3);
    });

    it('keeps the farms signal empty when the farms request fails', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();

      httpMock.expectOne((r) => r.url === PRODUCTS_URL && r.params.get('featured') === 'true').flush([]);
      httpMock.expectOne(FARMS_URL).flush(
        { message: 'Server error' },
        { status: 500, statusText: 'Internal Server Error' },
      );

      expect(component.farms()).toHaveSize(0);
    });
  });

  describe('"Meet Our Farms" section', () => {
    it('shows the farms section when at least one farm is loaded', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushAll(httpMock, { farms: [mockFarm()] });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.farms-section')).toBeTruthy();
    });

    it('hides the farms section when no farms are returned', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushAll(httpMock);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.farms-section')).toBeNull();
    });

    it('renders the farm name for each farm card', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushAll(httpMock, {
        farms: [
          mockFarm({ _id: 'f1', farmName: 'Meadow View Farm' }),
          mockFarm({ _id: 'f2', farmName: 'Oak Ridge Organics' }),
        ],
      });
      fixture.detectChanges();

      const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.farm-name'));
      const names = cards.map((el) => el.textContent?.trim());
      expect(names).toContain('Meadow View Farm');
      expect(names).toContain('Oak Ridge Organics');
    });

    it('renders at most 3 farm cards regardless of the response size', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();

      const manyFarms = ['f1', 'f2', 'f3', 'f4'].map((_id) => mockFarm({ _id }));
      flushAll(httpMock, { farms: manyFarms });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.farm-card').length).toBe(3);
    });
  });

  describe('featured products grid', () => {
    it('renders one product card per featured product', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushAll(httpMock, {
        products: [mockProduct(), mockProduct({ _id: 'p2', name: 'Eggs' })],
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('mat-card').length).toBe(2);
    });

    it('shows no product cards when the featured list is empty', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      flushAll(httpMock);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('mat-card').length).toBe(0);
    });
  });
});
