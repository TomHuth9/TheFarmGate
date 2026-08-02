import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CustomerProfileComponent } from './customer-profile.component';
import { environment } from '../../../environments/environment';

const ME_URL = `${environment.apiUrl}/users/me`;

const CUSTOMER = JSON.stringify({ id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'customer' });
const FARM_USER = JSON.stringify({ id: 'u2', name: 'Joe', email: 'joe@farm.com', role: 'farm' });

const meResponse = (overrides: Record<string, unknown> = {}) => ({
  _id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'customer',
  postcode: 'SW1A 1AA',
  ...overrides,
});

function setup(storedUser: string | null) {
  localStorage.clear();
  if (storedUser) localStorage.setItem('tfg_user', storedUser);

  TestBed.configureTestingModule({
    imports: [CustomerProfileComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
  });

  const fixture = TestBed.createComponent(CustomerProfileComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  return { fixture, component, httpMock, router };
}

describe('CustomerProfileComponent', () => {
  afterEach(() => localStorage.clear());

  describe('ngOnInit()', () => {
    it('redirects an unauthenticated visitor without making any HTTP call', () => {
      const { fixture, httpMock, router } = setup(null);
      spyOn(router, 'navigate');
      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
      httpMock.expectNone(ME_URL);
    });

    it('redirects a farm user without making any HTTP call', () => {
      const { fixture, httpMock, router } = setup(FARM_USER);
      spyOn(router, 'navigate');
      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
      httpMock.expectNone(ME_URL);
    });

    it('calls GET /api/users/me for a customer', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();

      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url === ME_URL);
      expect(req.request.method).toBe('GET');
      req.flush(meResponse());
    });

    it('pre-populates the form with name, email, and postcode from the API', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne((r) => r.method === 'GET' && r.url === ME_URL)
        .flush(meResponse({ name: 'Alice', postcode: 'SW1A 1AA' }));
      fixture.detectChanges();

      expect(component.form.get('name')?.value).toBe('Alice');
      expect(component.form.get('postcode')?.value).toBe('SW1A 1AA');
    });

    it('sets loading to false once the response arrives', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();

      expect(component.loading()).toBeTrue();
      httpMock.expectOne((r) => r.method === 'GET' && r.url === ME_URL).flush(meResponse());
      expect(component.loading()).toBeFalse();
    });

    it('still sets loading to false when the getMe call fails', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();

      httpMock.expectOne((r) => r.method === 'GET' && r.url === ME_URL)
        .flush({ message: 'Error' }, { status: 500, statusText: 'Internal Server Error' });

      expect(component.loading()).toBeFalse();
    });
  });

  describe('rendering', () => {
    it('shows a spinner while loading', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
      httpMock.expectOne((r) => r.method === 'GET' && r.url === ME_URL).flush(meResponse());
    });

    it('hides the spinner and shows the form after loading', () => {
      const { fixture, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne((r) => r.method === 'GET' && r.url === ME_URL).flush(meResponse());
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('mat-spinner')).toBeNull();
      expect(fixture.nativeElement.querySelector('form')).toBeTruthy();
    });

    it('the email field is disabled', () => {
      const { fixture, component, httpMock } = setup(CUSTOMER);
      fixture.detectChanges();
      httpMock.expectOne((r) => r.method === 'GET' && r.url === ME_URL).flush(meResponse());

      expect(component.form.get('email')?.disabled).toBeTrue();
    });
  });

  describe('save()', () => {
    function loadedSetup() {
      const ctx = setup(CUSTOMER);
      ctx.fixture.detectChanges();
      ctx.httpMock.expectOne((r) => r.method === 'GET' && r.url === ME_URL)
        .flush(meResponse({ name: 'Alice', postcode: 'SW1A 1AA' }));
      ctx.fixture.detectChanges();
      return ctx;
    }

    it('sends PATCH /api/users/me with name and postcode', () => {
      const { component, httpMock } = loadedSetup();

      component.form.patchValue({ name: 'Alice Smith', postcode: 'EC1A 1BB' });
      component.save();

      const req = httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL);
      expect(req.request.body).toEqual({ name: 'Alice Smith', postcode: 'EC1A 1BB' });
      req.flush(meResponse({ name: 'Alice Smith', postcode: 'EC1A 1BB' }));
    });

    it('sets saving() while the request is in flight and clears it on completion', () => {
      const { component, httpMock } = loadedSetup();

      component.form.patchValue({ name: 'Alice', postcode: '' });
      component.save();

      expect(component.saving()).toBeTrue();
      httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL)
        .flush(meResponse());
      expect(component.saving()).toBeFalse();
    });

    it('sets saved() to true on success and resets it after 3 seconds', fakeAsync(() => {
      const { component, httpMock } = loadedSetup();

      component.form.patchValue({ name: 'Alice', postcode: '' });
      component.save();
      httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL).flush(meResponse());

      expect(component.saved()).toBeTrue();
      tick(3001);
      expect(component.saved()).toBeFalse();
    }));

    it('sets error() with the server message on failure', () => {
      const { component, httpMock } = loadedSetup();

      component.form.patchValue({ name: 'Alice', postcode: '' });
      component.save();
      httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL)
        .flush({ message: 'Could not update profile' }, { status: 500, statusText: 'Internal Server Error' });

      expect(component.error()).toBe('Could not update profile');
      expect(component.saving()).toBeFalse();
    });

    it('clears a previous error when a new save starts', () => {
      const { component, httpMock } = loadedSetup();

      component.form.patchValue({ name: 'Alice', postcode: '' });
      component.save();
      httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL)
        .flush({ message: 'Failed' }, { status: 500, statusText: 'Internal Server Error' });
      expect(component.error()).toBeTruthy();

      component.save();
      expect(component.error()).toBeNull();
      httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL).flush(meResponse());
    });

    it('does nothing when the form is invalid (empty name)', () => {
      const { component, httpMock } = loadedSetup();

      component.form.patchValue({ name: '' });
      component.save();

      httpMock.expectNone((r) => r.method === 'PATCH' && r.url === ME_URL);
    });
  });
});
