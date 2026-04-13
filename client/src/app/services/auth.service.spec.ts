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
    it('stores the token and sets currentUser on success', () => {
      service.login('user@example.com', 'password123').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/users/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'user@example.com', password: 'password123' });

      req.flush({
        token: 'fake.jwt.token',
        user: { id: '123', name: 'Alice', email: 'user@example.com', role: 'customer' },
      });

      expect(localStorage.getItem('tfg_token')).toBe('fake.jwt.token');
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
        token: 'fake.jwt.token',
        user: { id: '456', name: 'Bob', email: 'bob@farm.com', role: 'farm', farmName: 'Sunny Acres' },
      });

      expect(service.currentUser()?.role).toBe('farm');
    });
  });

  describe('logout()', () => {
    it('clears the token and currentUser', () => {
      // Seed a token
      localStorage.setItem('tfg_token', 'fake.jwt.token');
      service.login('user@example.com', 'pass').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/users/login`).flush({
        token: 'fake.jwt.token',
        user: { id: '1', name: 'Alice', email: 'user@example.com', role: 'customer' },
      });

      service.logout();

      expect(localStorage.getItem('tfg_token')).toBeNull();
      expect(service.isLoggedIn()).toBeFalse();
      expect(service.currentUser()).toBeNull();
    });
  });

  describe('getToken()', () => {
    it('returns the token from localStorage', () => {
      localStorage.setItem('tfg_token', 'my-token');
      expect(service.getToken()).toBe('my-token');
    });

    it('returns null when no token is stored', () => {
      expect(service.getToken()).toBeNull();
    });
  });
});
