import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService } from './admin.service';
import { AdminUser } from '../models/user.model';
import { environment } from '../../environments/environment';

const mockAdminUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  _id: 'user1',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'customer',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;
  const BASE = `${environment.apiUrl}/users`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getUsers()', () => {
    it('sends a GET to /users', () => {
      service.getUsers().subscribe();
      const req = httpMock.expectOne(BASE);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('returns the response as an AdminUser array', () => {
      const users = [mockAdminUser(), mockAdminUser({ _id: 'user2', name: 'Bob', email: 'bob@example.com' })];
      let result: AdminUser[] = [];
      service.getUsers().subscribe((u) => (result = u));
      httpMock.expectOne(BASE).flush(users);
      expect(result).toHaveSize(2);
      expect(result[0].name).toBe('Alice');
    });
  });

  describe('updateUserRole()', () => {
    it('sends a PATCH to /users/:id/role with the role in the body', () => {
      service.updateUserRole('user1', 'farm').subscribe();
      const req = httpMock.expectOne(`${BASE}/user1/role`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ role: 'farm' });
      req.flush(mockAdminUser({ role: 'farm' }));
    });

    it('returns the updated user', () => {
      const updated = mockAdminUser({ role: 'admin' });
      let result: AdminUser | undefined;
      service.updateUserRole('user1', 'admin').subscribe((u) => (result = u));
      httpMock.expectOne(`${BASE}/user1/role`).flush(updated);
      expect(result?.role).toBe('admin');
    });
  });

  describe('deleteUser()', () => {
    it('sends a DELETE to /users/:id', () => {
      service.deleteUser('user1').subscribe();
      const req = httpMock.expectOne(`${BASE}/user1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
