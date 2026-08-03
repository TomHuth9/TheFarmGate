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

  describe('updateMe()', () => {
    const ME_URL = `${environment.apiUrl}/users/me`;

    beforeEach(() => {
      service.login('alice@example.com', 'pass').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/users/login`).flush({
        user: { id: '1', name: 'Alice', email: 'alice@example.com', role: 'customer' },
      });
    });

    it('sends a PATCH to /api/users/me with name and postcode', () => {
      service.updateMe({ name: 'Alice Updated', postcode: 'SW1A 1AA' }).subscribe();

      const req = httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL);
      expect(req.request.body).toEqual({ name: 'Alice Updated', postcode: 'SW1A 1AA' });
      req.flush({ _id: '1', name: 'Alice Updated', email: 'alice@example.com', role: 'customer', postcode: 'SW1A 1AA' });
    });

    it('updates currentUser signal name on success', () => {
      service.updateMe({ name: 'Alice New' }).subscribe();
      httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL).flush({
        _id: '1', name: 'Alice New', email: 'alice@example.com', role: 'customer',
      });

      expect(service.currentUser()?.name).toBe('Alice New');
    });

    it('persists the updated name to localStorage', () => {
      service.updateMe({ name: 'Alice New' }).subscribe();
      httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL).flush({
        _id: '1', name: 'Alice New', email: 'alice@example.com', role: 'customer',
      });

      const stored = JSON.parse(localStorage.getItem('tfg_user')!);
      expect(stored.name).toBe('Alice New');
    });

    it('does not alter other currentUser fields when updating name', () => {
      service.updateMe({ name: 'Alice New' }).subscribe();
      httpMock.expectOne((r) => r.method === 'PATCH' && r.url === ME_URL).flush({
        _id: '1', name: 'Alice New', email: 'alice@example.com', role: 'customer',
      });

      expect(service.currentUser()?.email).toBe('alice@example.com');
      expect(service.currentUser()?.role).toBe('customer');
    });
  });

  describe('changePassword()', () => {
    const CHANGE_PW_URL = `${environment.apiUrl}/users/change-password`;

    it('sends POST to /change-password with currentPassword and newPassword', () => {
      service.changePassword('oldpass', 'newpass123').subscribe();

      const req = httpMock.expectOne(CHANGE_PW_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ currentPassword: 'oldpass', newPassword: 'newpass123' });
      req.flush({ message: 'Password changed successfully' });
    });

    it('completes successfully when the server returns 200', () => {
      let resolved = false;
      service.changePassword('old', 'new123456').subscribe(() => (resolved = true));

      httpMock.expectOne(CHANGE_PW_URL).flush({ message: 'Password changed successfully' });
      expect(resolved).toBeTrue();
    });

    it('propagates the error when the server rejects the current password', () => {
      let errMsg = '';
      service.changePassword('wrong', 'newpass123').subscribe({
        error: (e) => (errMsg = e.error.message),
      });

      httpMock.expectOne(CHANGE_PW_URL).flush(
        { message: 'Current password is incorrect' },
        { status: 401, statusText: 'Unauthorized' }
      );

      expect(errMsg).toBe('Current password is incorrect');
    });

    it('does not alter currentUser after a successful password change', () => {
      service.login('alice@example.com', 'old').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/users/login`).flush({
        user: { id: '1', name: 'Alice', email: 'alice@example.com', role: 'customer' },
      });

      service.changePassword('old', 'newpass123').subscribe();
      httpMock.expectOne(CHANGE_PW_URL).flush({ message: 'Password changed successfully' });

      expect(service.currentUser()?.email).toBe('alice@example.com');
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
