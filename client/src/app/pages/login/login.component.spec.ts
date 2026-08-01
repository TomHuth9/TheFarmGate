import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { LoginComponent } from './login.component';
import { environment } from '../../../environments/environment';

const LOGIN_URL = `${environment.apiUrl}/users/login`;
const REGISTER_URL = `${environment.apiUrl}/users/register`;

const activatedRouteStub = (path: string) => ({ snapshot: { url: [{ path }] } });

function setup(routePath = 'login') {
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideNoopAnimations(),
      { provide: ActivatedRoute, useValue: activatedRouteStub(routePath) },
    ],
  });

  const fixture = TestBed.createComponent(LoginComponent);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  fixture.detectChanges();
  return { fixture, component, httpMock, router };
}

describe('LoginComponent', () => {
  afterEach(() => localStorage.clear());

  describe('ngOnInit()', () => {
    it('defaults to the Sign In tab on the /login route', () => {
      const { component, httpMock } = setup('login');
      expect(component.activeTab()).toBe(0);
      httpMock.verify();
    });

    it('selects the Create Account tab on the /register route', () => {
      const { component, httpMock } = setup('register');
      expect(component.activeTab()).toBe(1);
      httpMock.verify();
    });
  });

  describe('toggleFarm()', () => {
    it('makes farmName required when switching to farm registration', () => {
      const { component, httpMock } = setup();
      component.toggleFarm(true);
      const farmName = component.registerForm.get('farmName')!;
      farmName.setValue('');
      expect(farmName.valid).toBeFalse();
      httpMock.verify();
    });

    it('clears the farmName requirement when switching back to customer', () => {
      const { component, httpMock } = setup();
      component.toggleFarm(true);
      component.toggleFarm(false);
      const farmName = component.registerForm.get('farmName')!;
      farmName.setValue('');
      expect(farmName.valid).toBeTrue();
      httpMock.verify();
    });
  });

  describe('onLogin()', () => {
    it('is a no-op when the form is invalid', () => {
      const { component, httpMock } = setup();
      component.onLogin();
      httpMock.expectNone(LOGIN_URL);
    });

    it('sends credentials and navigates customers to the home page', () => {
      const { component, httpMock, router } = setup();
      spyOn(router, 'navigate');
      component.loginForm.setValue({ email: 'alice@example.com', password: 'secret1' });

      component.onLogin();

      const req = httpMock.expectOne(LOGIN_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'alice@example.com', password: 'secret1' });
      req.flush({ user: { id: '1', name: 'Alice', email: 'alice@example.com', role: 'customer' } });

      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('navigates farm users to the farm dashboard', () => {
      const { component, httpMock, router } = setup();
      spyOn(router, 'navigate');
      component.loginForm.setValue({ email: 'farmer@example.com', password: 'secret1' });

      component.onLogin();

      httpMock
        .expectOne(LOGIN_URL)
        .flush({ user: { id: '2', name: 'Farmer', email: 'farmer@example.com', role: 'farm' } });

      expect(router.navigate).toHaveBeenCalledWith(['/farm-dashboard']);
    });

    it('sets the error signal and clears loading on failure', () => {
      const { component, httpMock } = setup();
      component.loginForm.setValue({ email: 'alice@example.com', password: 'wrong' });

      component.onLogin();
      httpMock
        .expectOne(LOGIN_URL)
        .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

      expect(component.error()).toBe('Invalid credentials');
      expect(component.loading()).toBeFalse();
    });
  });

  describe('onRegister()', () => {
    it('is a no-op when the form is invalid', () => {
      const { component, httpMock } = setup();
      component.onRegister();
      httpMock.expectNone(REGISTER_URL);
    });

    it('registers a customer with role "customer"', () => {
      const { component, httpMock, router } = setup();
      spyOn(router, 'navigate');
      component.registerForm.setValue({
        name: 'Alice', email: 'alice@example.com', password: 'secret1',
        postcode: 'SW1 1AA', farmName: '', farmDescription: '', farmLocation: '',
      });

      component.onRegister();

      const req = httpMock.expectOne(REGISTER_URL);
      expect(req.request.body.role).toBe('customer');
      req.flush({ user: { id: '1', name: 'Alice', email: 'alice@example.com', role: 'customer' } });

      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('registers a farm with role "farm" when the toggle is on', () => {
      const { component, httpMock, router } = setup();
      spyOn(router, 'navigate');
      component.toggleFarm(true);
      component.registerForm.setValue({
        name: 'Farmer', email: 'farmer@example.com', password: 'secret1',
        postcode: '', farmName: 'Meadow View', farmDescription: 'Nice farm', farmLocation: 'Shropshire',
      });

      component.onRegister();

      const req = httpMock.expectOne(REGISTER_URL);
      expect(req.request.body.role).toBe('farm');
      expect(req.request.body.farmName).toBe('Meadow View');
      req.flush({ user: { id: '2', name: 'Farmer', email: 'farmer@example.com', role: 'farm' } });

      expect(router.navigate).toHaveBeenCalledWith(['/farm-dashboard']);
    });

    it('sets the error signal and clears loading on failure', () => {
      const { component, httpMock } = setup();
      component.registerForm.setValue({
        name: 'Alice', email: 'alice@example.com', password: 'secret1',
        postcode: '', farmName: '', farmDescription: '', farmLocation: '',
      });

      component.onRegister();
      httpMock
        .expectOne(REGISTER_URL)
        .flush({ message: 'Email already in use' }, { status: 409, statusText: 'Conflict' });

      expect(component.error()).toBe('Email already in use');
      expect(component.loading()).toBeFalse();
    });
  });
});
