import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReviewService } from './review.service';
import { environment } from '../../environments/environment';

const PRODUCT_ID = 'prod1';
const REVIEWS_URL = `${environment.apiUrl}/products/${PRODUCT_ID}/reviews`;

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const service = TestBed.inject(ReviewService);
  const httpMock = TestBed.inject(HttpTestingController);
  return { service, httpMock };
}

describe('ReviewService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('getForProduct()', () => {
    it('sends GET to the reviews endpoint with page=1 by default', () => {
      const { service, httpMock } = setup();

      service.getForProduct(PRODUCT_ID).subscribe();

      const req = httpMock.expectOne((r) => r.url === REVIEWS_URL && r.params.get('page') === '1');
      expect(req.request.method).toBe('GET');
      req.flush({ reviews: [], total: 0, page: 1, pages: 0, avgRating: null, count: 0 });
    });

    it('sends the correct page param when page > 1', () => {
      const { service, httpMock } = setup();

      service.getForProduct(PRODUCT_ID, 3).subscribe();

      const req = httpMock.expectOne((r) => r.url === REVIEWS_URL && r.params.get('page') === '3');
      expect(req.request.params.get('page')).toBe('3');
      req.flush({ reviews: [], total: 0, page: 3, pages: 3, avgRating: null, count: 0 });
    });

    it('returns the ReviewPage payload from the response', () => {
      const { service, httpMock } = setup();
      const payload = { reviews: [{ _id: 'r1', rating: 5 }], total: 1, page: 1, pages: 1, avgRating: 5, count: 1 };

      let result: unknown;
      service.getForProduct(PRODUCT_ID).subscribe((r) => (result = r));

      httpMock.expectOne((r) => r.url === REVIEWS_URL).flush(payload);
      expect(result).toEqual(payload);
    });
  });

  describe('submit()', () => {
    it('sends POST to the reviews endpoint with rating and body', () => {
      const { service, httpMock } = setup();

      service.submit(PRODUCT_ID, 4, 'Lovely cheese.').subscribe();

      const req = httpMock.expectOne(REVIEWS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ rating: 4, body: 'Lovely cheese.' });
      req.flush({ _id: 'rev1', rating: 4, body: 'Lovely cheese.' });
    });

    it('sends an empty body string when no body is provided', () => {
      const { service, httpMock } = setup();

      service.submit(PRODUCT_ID, 5, '').subscribe();

      const req = httpMock.expectOne(REVIEWS_URL);
      expect(req.request.body.body).toBe('');
      req.flush({ _id: 'rev1', rating: 5, body: '' });
    });

    it('returns the created Review from the response', () => {
      const { service, httpMock } = setup();
      const payload = { _id: 'rev1', product: PRODUCT_ID, user: { _id: 'u1', name: 'Tom' }, rating: 3, body: 'OK', createdAt: '' };

      let result: unknown;
      service.submit(PRODUCT_ID, 3, 'OK').subscribe((r) => (result = r));

      httpMock.expectOne(REVIEWS_URL).flush(payload);
      expect(result).toEqual(payload);
    });
  });
});
