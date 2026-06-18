import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with no logged-in user when localStorage is empty', () => {
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.currentUser()).toBeNull();
  });

  describe('login()', () => {
    it('stores user info and sets currentUser on success', () => {
      service.login('user@example.com', 'password123').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/users/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'user@example.com', password: 'password123' });

      req.flush({
        user: { id: '123', name: 'Alice', email: 'user@example.com', role: 'customer' },
      });

      const stored = JSON.parse(localStorage.getItem('tfg_user')!);
      expect(stored.email).toBe('user@example.com');
      expect(service.isLoggedIn()).toBeTrue();
      expect(service.currentUser()?.email).toBe('user@example.com');
    });
  });

  describe('register()', () => {
    it('sends all fields including role and farm details', () => {
      service
        .register('Bob', 'bob@farm.com', 'pass123', '', 'farm', 'Sunny Acres', 'A nice farm', 'Devon')
        .subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/users/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.role).toBe('farm');
      expect(req.request.body.farmName).toBe('Sunny Acres');

      req.flush({
        user: { id: '456', name: 'Bob', email: 'bob@farm.com', role: 'farm', farmName: 'Sunny Acres' },
      });

      expect(service.currentUser()?.role).toBe('farm');
    });
  });

  describe('logout()', () => {
    it('clears user info and currentUser', () => {
      service.login('user@example.com', 'pass').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/users/login`).flush({
        user: { id: '1', name: 'Alice', email: 'user@example.com', role: 'customer' },
      });

      service.logout();
      httpMock.expectOne(`${environment.apiUrl}/users/logout`).flush({});

      expect(localStorage.getItem('tfg_user')).toBeNull();
      expect(service.isLoggedIn()).toBeFalse();
      expect(service.currentUser()).toBeNull();
    });

    it('still clears the session when the logout request fails', () => {
      service.login('user@example.com', 'pass').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/users/login`).flush({
        user: { id: '1', name: 'Alice', email: 'user@example.com', role: 'customer' },
      });

      service.logout();
      httpMock
        .expectOne(`${environment.apiUrl}/users/logout`)
        .flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      expect(localStorage.getItem('tfg_user')).toBeNull();
      expect(service.isLoggedIn()).toBeFalse();
    });
  });

  describe('isLoggedIn()', () => {
    it('returns true after a successful login', () => {
      service.login('user@example.com', 'pass').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/users/login`).flush({
        user: { id: '1', name: 'Alice', email: 'user@example.com', role: 'customer' },
      });

      expect(service.isLoggedIn()).toBeTrue();
    });
  });

  describe('forgotPassword()', () => {
    it('sends a POST to /forgot-password with the email', () => {
      service.forgotPassword('user@example.com').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/users/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'user@example.com' });
      req.flush({ message: 'If an account exists...' });
    });
  });

  describe('resetPassword()', () => {
    it('sends a POST to /reset-password/:token with the new password', () => {
      const token = 'abc123token';
      service.resetPassword(token, 'newpassword123').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/users/reset-password/${token}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ password: 'newpassword123' });
      req.flush({ message: 'Password updated successfully.' });
    });
  });

  describe('persistence', () => {
    it('restores currentUser from localStorage without any HTTP request', () => {
      // Re-initialise the service after putting a user in localStorage
      TestBed.resetTestingModule();
      localStorage.setItem(
        'tfg_user',
        JSON.stringify({ id: '42', name: 'Bob', email: 'bob@example.com', role: 'farm' })
      );
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      });
      const freshService = TestBed.inject(AuthService);
      const freshMock = TestBed.inject(HttpTestingController);

      expect(freshService.isLoggedIn()).toBeTrue();
      expect(freshService.currentUser()?.email).toBe('bob@example.com');

      freshMock.verify();
    });
  });
});
