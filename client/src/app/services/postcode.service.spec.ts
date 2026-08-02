import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PostcodeService, LatLng } from './postcode.service';

const API = 'https://api.postcodes.io';
const LOOKUP_URL = (pc: string) => `${API}/postcodes/${encodeURIComponent(pc)}`;
const BULK_URL = `${API}/postcodes`;

const LONDON:     LatLng = { lat: 51.5074, lng: -0.1278 };
const MANCHESTER: LatLng = { lat: 53.4808, lng: -2.2426 };
const EDINBURGH:  LatLng = { lat: 55.9533, lng: -3.1883 };

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const service = TestBed.inject(PostcodeService);
  const httpMock = TestBed.inject(HttpTestingController);
  return { service, httpMock };
}

describe('PostcodeService', () => {

  // ── lookup() ──────────────────────────────────────────────────────────────────
  describe('lookup()', () => {
    it('returns LatLng for a valid postcode', () => {
      const { service, httpMock } = setup();
      let result: LatLng | null | undefined;

      service.lookup('SW1A 1AA').subscribe((r) => (result = r));

      httpMock.expectOne(LOOKUP_URL('SW1A 1AA')).flush({
        status: 200,
        result: { latitude: 51.5014, longitude: -0.1419, postcode: 'SW1A 1AA' },
      });

      expect(result).toEqual({ lat: 51.5014, lng: -0.1419 });
    });

    it('returns null when the API returns a null result (terminated postcode)', () => {
      const { service, httpMock } = setup();
      let result: LatLng | null | undefined;

      service.lookup('ZZ99 9ZZ').subscribe((r) => (result = r));

      httpMock.expectOne(LOOKUP_URL('ZZ99 9ZZ')).flush({ status: 200, result: null });

      expect(result).toBeNull();
    });

    it('returns null on a 404 (invalid format)', () => {
      const { service, httpMock } = setup();
      let result: LatLng | null | undefined;

      service.lookup('INVALID').subscribe((r) => (result = r));

      httpMock
        .expectOne(LOOKUP_URL('INVALID'))
        .flush({ error: 'Invalid postcode' }, { status: 404, statusText: 'Not Found' });

      expect(result).toBeNull();
    });

    it('returns null on a network error', () => {
      const { service, httpMock } = setup();
      let result: LatLng | null | undefined;

      service.lookup('SW1A 1AA').subscribe((r) => (result = r));

      httpMock.expectOne(LOOKUP_URL('SW1A 1AA')).error(new ProgressEvent('network error'));

      expect(result).toBeNull();
    });

    it('URL-encodes the postcode (spaces become %20)', () => {
      const { service, httpMock } = setup();

      service.lookup('SW1A 1AA').subscribe();

      const req = httpMock.expectOne(LOOKUP_URL('SW1A 1AA'));
      expect(req.request.url).toContain('SW1A%201AA');
      req.flush({ status: 200, result: { latitude: 51.5, longitude: -0.1 } });
    });
  });

  // ── bulkLookup() ──────────────────────────────────────────────────────────────
  describe('bulkLookup()', () => {
    it('returns an empty array without making an HTTP call when given no postcodes', () => {
      const { service, httpMock } = setup();
      let result: (LatLng | null)[] | undefined;

      service.bulkLookup([]).subscribe((r) => (result = r));

      httpMock.expectNone(BULK_URL);
      expect(result).toEqual([]);
    });

    it('returns LatLng values in the same order as the input postcodes', () => {
      const { service, httpMock } = setup();
      let result: (LatLng | null)[] | undefined;

      service.bulkLookup(['YO1 9FE', 'EC1A 1BB']).subscribe((r) => (result = r));

      httpMock.expectOne(BULK_URL).flush({
        status: 200,
        result: [
          { query: 'YO1 9FE',  result: { latitude: 53.96, longitude: -1.08 } },
          { query: 'EC1A 1BB', result: { latitude: 51.52, longitude: -0.10 } },
        ],
      });

      expect(result).toEqual([
        { lat: 53.96, lng: -1.08 },
        { lat: 51.52, lng: -0.10 },
      ]);
    });

    it('places null at the position of a postcode that could not be resolved', () => {
      const { service, httpMock } = setup();
      let result: (LatLng | null)[] | undefined;

      service.bulkLookup(['VALID', 'INVALID', 'VALID2']).subscribe((r) => (result = r));

      httpMock.expectOne(BULK_URL).flush({
        status: 200,
        result: [
          { query: 'VALID',   result: { latitude: 51.5, longitude: -0.1 } },
          { query: 'INVALID', result: null },
          { query: 'VALID2',  result: { latitude: 52.0, longitude: -1.0 } },
        ],
      });

      expect(result![1]).toBeNull();
      expect(result![0]).not.toBeNull();
      expect(result![2]).not.toBeNull();
    });

    it('returns an array of nulls on HTTP error', () => {
      const { service, httpMock } = setup();
      let result: (LatLng | null)[] | undefined;

      service.bulkLookup(['A', 'B', 'C']).subscribe((r) => (result = r));

      httpMock
        .expectOne(BULK_URL)
        .flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      expect(result).toEqual([null, null, null]);
    });

    it('sends the postcodes array in the request body', () => {
      const { service, httpMock } = setup();

      service.bulkLookup(['YO1 9FE', 'SW1A 1AA']).subscribe();

      const req = httpMock.expectOne(BULK_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ postcodes: ['YO1 9FE', 'SW1A 1AA'] });
      req.flush({ status: 200, result: [] });
    });
  });

  // ── distanceKm() ─────────────────────────────────────────────────────────────
  describe('distanceKm()', () => {
    it('returns 0 for identical points', () => {
      const { service } = setup();
      expect(service.distanceKm(LONDON, LONDON)).toBe(0);
    });

    it('is commutative (A→B equals B→A)', () => {
      const { service } = setup();
      const ab = service.distanceKm(LONDON, MANCHESTER);
      const ba = service.distanceKm(MANCHESTER, LONDON);
      expect(ab).toBeCloseTo(ba, 6);
    });

    it('gives approximately 263 km between London and Manchester', () => {
      const { service } = setup();
      const km = service.distanceKm(LONDON, MANCHESTER);
      // Great-circle distance is ≈ 263 km; allow ±5 km for floating-point rounding
      expect(km).toBeGreaterThan(258);
      expect(km).toBeLessThan(268);
    });

    it('gives approximately 534 km between London and Edinburgh', () => {
      const { service } = setup();
      const km = service.distanceKm(LONDON, EDINBURGH);
      expect(km).toBeGreaterThan(529);
      expect(km).toBeLessThan(539);
    });

    it('distance increases as points get further apart', () => {
      const { service } = setup();
      const close  = service.distanceKm(LONDON, MANCHESTER);
      const farther = service.distanceKm(LONDON, EDINBURGH);
      expect(farther).toBeGreaterThan(close);
    });
  });
});
