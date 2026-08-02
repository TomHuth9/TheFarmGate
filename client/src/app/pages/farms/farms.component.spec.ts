import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FarmsComponent } from './farms.component';
import { Farm } from '../../models/user.model';
import { environment } from '../../../environments/environment';

const FARMS_URL = `${environment.apiUrl}/farms`;
const POSTCODES_IO = 'https://api.postcodes.io';
const LOOKUP_URL = (pc: string) => `${POSTCODES_IO}/postcodes/${encodeURIComponent(pc)}`;
const BULK_URL = `${POSTCODES_IO}/postcodes`;

const mockFarm = (overrides: Partial<Farm> = {}): Farm => ({
  _id: 'farm1',
  name: 'Green Acres',
  farmName: 'Green Acres Farm',
  farmDescription: 'A lovely organic farm in the Yorkshire Dales.',
  farmLocation: 'Yorkshire, UK',
  ...overrides,
});

const LONDON_COORDS = { latitude: 51.5074, longitude: -0.1278 };
const YORK_COORDS   = { latitude: 53.9591, longitude: -1.0815 };

function setup() {
  TestBed.configureTestingModule({
    imports: [FarmsComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
  });
  const fixture = TestBed.createComponent(FarmsComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  return { fixture, component, httpMock };
}

describe('FarmsComponent', () => {
  // ── Initial load (unchanged behaviour) ───────────────────────────────────────
  describe('initial load', () => {
    it('shows a spinner while loading', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();

      expect(component.loading()).toBeTrue();
      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();

      httpMock.expectOne(FARMS_URL).flush([]);
    });

    it('stops loading after the HTTP response arrives', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([]);

      expect(component.loading()).toBeFalse();
    });

    it('shows the empty state when no farms are returned', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.farm-card')).toBeNull();
    });

    it('renders one card per farm', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([
        mockFarm(),
        mockFarm({ _id: 'farm2', farmName: 'Sunny Meadows Farm' }),
      ]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('.farm-card').length).toBe(2);
    });

    it('shows the farm name in each card', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm()]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.farm-name').textContent).toContain('Green Acres Farm');
    });

    it('shows the farm location when provided', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm()]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.farm-location').textContent).toContain('Yorkshire, UK');
    });

    it('links each card to the correct farm profile page', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm({ _id: 'farm42' })]);
      fixture.detectChanges();

      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.farm-card-footer a');
      expect(link.getAttribute('href')).toContain('/farms/farm42');
    });

    it('stops loading and shows no farms when the HTTP request errors', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush(
        { message: 'Server error' },
        { status: 500, statusText: 'Internal Server Error' },
      );

      expect(component.loading()).toBeFalse();
      expect(component.farms()).toHaveSize(0);
    });
  });

  // ── search() — postcode geocoding ─────────────────────────────────────────────
  describe('search()', () => {
    it('calls postcodes.io with the entered postcode', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm({ postcode: 'YO1 9FE' })]);

      component.postcodeControl.setValue('SW1A 1AA');
      component.search();

      const req = httpMock.expectOne(LOOKUP_URL('SW1A 1AA'));
      expect(req.request.method).toBe('GET');
      req.flush({ status: 200, result: LONDON_COORDS });
      httpMock.expectOne(BULK_URL).flush({ status: 200, result: [{ query: 'YO1 9FE', result: YORK_COORDS }] });
    });

    it('sets locationError and clears searching when the postcode is not found', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([]);

      component.postcodeControl.setValue('ZZ99 9ZZ');
      component.search();

      httpMock.expectOne(LOOKUP_URL('ZZ99 9ZZ')).flush({ status: 200, result: null });

      expect(component.locationError()).toBeTruthy();
      expect(component.searching()).toBeFalse();
    });

    it('sets locationError on a 404 from postcodes.io', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([]);

      component.postcodeControl.setValue('INVALID');
      component.search();

      httpMock.expectOne(LOOKUP_URL('INVALID')).flush(
        { error: 'Invalid postcode' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(component.locationError()).toBeTruthy();
      expect(component.searching()).toBeFalse();
    });

    it('skips the bulk call and sets activePostcode when no farms have a postcode', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm()]); // no postcode field

      component.postcodeControl.setValue('SW1A 1AA');
      component.search();

      httpMock.expectOne(LOOKUP_URL('SW1A 1AA')).flush({ status: 200, result: LONDON_COORDS });
      httpMock.expectNone(BULK_URL);

      expect(component.activePostcode()).toBe('SW1A 1AA');
      expect(component.searching()).toBeFalse();
    });

    it('sets activePostcode after a successful search', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm({ postcode: 'YO1 9FE' })]);

      component.postcodeControl.setValue('sw1a 1aa');
      component.search();

      httpMock.expectOne(LOOKUP_URL('sw1a 1aa')).flush({ status: 200, result: LONDON_COORDS });
      httpMock.expectOne(BULK_URL).flush({ status: 200, result: [{ query: 'YO1 9FE', result: YORK_COORDS }] });

      expect(component.activePostcode()).toBe('SW1A 1AA');
    });

    it('clears the searching flag after the bulk call completes', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm({ postcode: 'YO1 9FE' })]);

      component.postcodeControl.setValue('SW1A 1AA');
      component.search();

      expect(component.searching()).toBeTrue();

      httpMock.expectOne(LOOKUP_URL('SW1A 1AA')).flush({ status: 200, result: LONDON_COORDS });
      httpMock.expectOne(BULK_URL).flush({ status: 200, result: [{ query: 'YO1 9FE', result: YORK_COORDS }] });

      expect(component.searching()).toBeFalse();
    });

    it('does nothing when the postcode input is empty', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([]);

      component.postcodeControl.setValue('');
      component.search();

      httpMock.expectNone(LOOKUP_URL(''));
      expect(component.searching()).toBeFalse();
    });
  });

  // ── sortedFarms() — distance sorting ─────────────────────────────────────────
  describe('sortedFarms()', () => {
    it('returns farms in their original order before any search', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      const farms = [
        mockFarm({ _id: 'f1', farmName: 'Zebra Farm' }),
        mockFarm({ _id: 'f2', farmName: 'Apple Farm' }),
      ];
      httpMock.expectOne(FARMS_URL).flush(farms);

      const ids = component.sortedFarms().map((f) => f._id);
      expect(ids).toEqual(['f1', 'f2']);
    });

    it('sorts farms by distance after a successful search', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      // farm-far is in York (~200 miles from London), farm-near is in central London
      httpMock.expectOne(FARMS_URL).flush([
        mockFarm({ _id: 'farm-far',  postcode: 'YO1 9FE' }),
        mockFarm({ _id: 'farm-near', postcode: 'EC1A 1BB' }),
      ]);

      component.postcodeControl.setValue('SW1A 1AA');
      component.search();

      httpMock.expectOne(LOOKUP_URL('SW1A 1AA')).flush({ status: 200, result: LONDON_COORDS });
      // Bulk returns coords in the same order as requested: [YO1 first, EC1A second]
      httpMock.expectOne(BULK_URL).flush({
        status: 200,
        result: [
          { query: 'YO1 9FE',  result: YORK_COORDS },          // far
          { query: 'EC1A 1BB', result: { latitude: 51.52, longitude: -0.10 } }, // near
        ],
      });

      const ids = component.sortedFarms().map((f) => f._id);
      expect(ids[0]).toBe('farm-near');
      expect(ids[1]).toBe('farm-far');
    });

    it('places farms without a postcode after those with distance', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([
        mockFarm({ _id: 'no-postcode' }),
        mockFarm({ _id: 'with-postcode', postcode: 'YO1 9FE' }),
      ]);

      component.postcodeControl.setValue('SW1A 1AA');
      component.search();

      httpMock.expectOne(LOOKUP_URL('SW1A 1AA')).flush({ status: 200, result: LONDON_COORDS });
      httpMock.expectOne(BULK_URL).flush({
        status: 200,
        result: [{ query: 'YO1 9FE', result: YORK_COORDS }],
      });

      const ids = component.sortedFarms().map((f) => f._id);
      expect(ids[0]).toBe('with-postcode');
      expect(ids[1]).toBe('no-postcode');
    });

    it('attaches a distanceMi value to farms after a successful search', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm({ _id: 'f1', postcode: 'YO1 9FE' })]);

      component.postcodeControl.setValue('SW1A 1AA');
      component.search();

      httpMock.expectOne(LOOKUP_URL('SW1A 1AA')).flush({ status: 200, result: LONDON_COORDS });
      httpMock.expectOne(BULK_URL).flush({
        status: 200,
        result: [{ query: 'YO1 9FE', result: YORK_COORDS }],
      });

      const farm = component.sortedFarms()[0];
      expect(farm.distanceMi).toBeDefined();
      expect(farm.distanceMi!).toBeGreaterThan(0);
    });

    it('shows the distance badge in the card after a successful search', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm({ postcode: 'YO1 9FE' })]);
      fixture.detectChanges();

      const { component } = fixture.debugElement.componentInstance
        ? { component: fixture.componentInstance }
        : { component: fixture.componentInstance };

      component.postcodeControl.setValue('SW1A 1AA');
      component.search();

      httpMock.expectOne(LOOKUP_URL('SW1A 1AA')).flush({ status: 200, result: LONDON_COORDS });
      httpMock.expectOne(BULK_URL).flush({
        status: 200,
        result: [{ query: 'YO1 9FE', result: YORK_COORDS }],
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.distance-badge')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.distance-badge').textContent).toContain('mi');
    });

    it('hides the distance badge when no search has been performed', () => {
      const { fixture, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([mockFarm({ postcode: 'YO1 9FE' })]);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.distance-badge')).toBeNull();
    });
  });

  // ── clearSearch() ─────────────────────────────────────────────────────────────
  describe('clearSearch()', () => {
    it('resets activePostcode, locationError, and the form control', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      httpMock.expectOne(FARMS_URL).flush([]);

      component.postcodeControl.setValue('ZZ99 9ZZ');
      component.search();
      httpMock.expectOne(LOOKUP_URL('ZZ99 9ZZ')).flush({ status: 200, result: null });

      component.clearSearch();

      expect(component.activePostcode()).toBeNull();
      expect(component.locationError()).toBeNull();
      expect(component.postcodeControl.value).toBe('');
    });

    it('removes distance badges and restores original order', () => {
      const { fixture, component, httpMock } = setup();
      fixture.detectChanges();
      const farms = [
        mockFarm({ _id: 'farm-far',  postcode: 'YO1 9FE' }),
        mockFarm({ _id: 'farm-near', postcode: 'EC1A 1BB' }),
      ];
      httpMock.expectOne(FARMS_URL).flush(farms);

      component.postcodeControl.setValue('SW1A 1AA');
      component.search();
      httpMock.expectOne(LOOKUP_URL('SW1A 1AA')).flush({ status: 200, result: LONDON_COORDS });
      httpMock.expectOne(BULK_URL).flush({
        status: 200,
        result: [
          { query: 'YO1 9FE',  result: YORK_COORDS },
          { query: 'EC1A 1BB', result: { latitude: 51.52, longitude: -0.10 } },
        ],
      });

      component.clearSearch();

      // distanceMi should be gone and order reverted to original
      expect(component.sortedFarms().every((f) => f.distanceMi === undefined)).toBeTrue();
      expect(component.sortedFarms()[0]._id).toBe('farm-far');
    });
  });
});
