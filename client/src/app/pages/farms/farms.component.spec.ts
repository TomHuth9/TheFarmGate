import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FarmsComponent } from './farms.component';
import { Farm } from '../../models/user.model';
import { environment } from '../../../environments/environment';

const FARMS_URL = `${environment.apiUrl}/farms`;

const mockFarm = (overrides: Partial<Farm> = {}): Farm => ({
  _id: 'farm1',
  name: 'Green Acres',
  farmName: 'Green Acres Farm',
  farmDescription: 'A lovely organic farm in the Yorkshire Dales.',
  farmLocation: 'Yorkshire, UK',
  ...overrides,
});

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
        { status: 500, statusText: 'Internal Server Error' }
      );

      expect(component.loading()).toBeFalse();
      expect(component.farms()).toHaveSize(0);
    });
  });
});
