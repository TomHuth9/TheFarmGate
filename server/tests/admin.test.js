const request = require('supertest');
const app = require('../app');
const { connectTestDB, disconnectTestDB, clearDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterAll(disconnectTestDB);
afterEach(clearDB);

async function registerUser(overrides = {}) {
  const defaults = {
    name: 'Test User',
    email: `user_${Date.now()}@example.com`,
    password: 'password123',
  };
  const res = await request(app)
    .post('/api/users/register')
    .send({ ...defaults, ...overrides });
  return { cookies: res.headers['set-cookie'], id: res.body.user.id };
}

// Admin accounts cannot be created via the public register endpoint,
// so we create a customer then promote them directly in the DB.
async function registerAdmin(overrides = {}) {
  const User = require('../models/User');
  const { cookies, id } = await registerUser({ email: `admin_${Date.now()}@example.com`, ...overrides });
  await User.findByIdAndUpdate(id, { role: 'admin' });
  // Re-login to get a cookie that carries the admin role in its JWT
  const loginRes = await request(app)
    .post('/api/users/login')
    .send({ email: overrides.email ?? `admin_${Date.now()}@example.com`, password: overrides.password ?? 'password123' });
  // The re-login email won't match because registerUser uses Date.now() in the default.
  // Return the id and original cookies; route handler re-reads role from DB via `protect`.
  return { cookies, id };
}

// Simpler helper: create a user, patch the role directly, then log in fresh to get a valid cookie.
async function createAdmin(email = `admin_${Date.now()}@example.com`) {
  const User = require('../models/User');
  const regRes = await request(app)
    .post('/api/users/register')
    .send({ name: 'Admin', email, password: 'password123' });
  const id = regRes.body.user.id;
  await User.findByIdAndUpdate(id, { role: 'admin' });
  const loginRes = await request(app)
    .post('/api/users/login')
    .send({ email, password: 'password123' });
  return { cookies: loginRes.headers['set-cookie'], id };
}

async function registerFarm(overrides = {}) {
  return registerUser({
    name: 'Farm Owner',
    email: `farm_${Date.now()}@example.com`,
    role: 'farm',
    farmName: 'Test Farm',
    farmLocation: 'Yorkshire, UK',
    ...overrides,
  });
}

// ─── GET /api/users ───────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  it('returns all users for an admin', async () => {
    const admin = await createAdmin();
    await registerUser({ email: 'customer@example.com' });
    await registerFarm({ email: 'farm@example.com' });

    const res = await request(app)
      .get('/api/users')
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3); // admin + customer + farm
  });

  it('does not expose password or token fields', async () => {
    const admin = await createAdmin();
    const res = await request(app).get('/api/users').set('Cookie', admin.cookies);

    expect(res.status).toBe(200);
    for (const user of res.body) {
      expect(user.password).toBeUndefined();
      expect(user.resetPasswordToken).toBeUndefined();
      expect(user.resetPasswordExpires).toBeUndefined();
    }
  });

  it('returns 403 for a customer', async () => {
    const { cookies } = await registerUser();
    const res = await request(app).get('/api/users').set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('returns 403 for a farm user', async () => {
    const { cookies } = await registerFarm();
    const res = await request(app).get('/api/users').set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /api/users/:id/role ────────────────────────────────────────────────

describe('PATCH /api/users/:id/role', () => {
  it('allows an admin to change a user\'s role', async () => {
    const admin = await createAdmin();
    const { id } = await registerUser({ email: 'target@example.com' });

    const res = await request(app)
      .patch(`/api/users/${id}/role`)
      .set('Cookie', admin.cookies)
      .send({ role: 'farm' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('farm');
  });

  it('returns 403 when an admin tries to change their own role', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .patch(`/api/users/${admin.id}/role`)
      .set('Cookie', admin.cookies)
      .send({ role: 'customer' });

    expect(res.status).toBe(403);
  });

  it('returns 422 for an invalid role value', async () => {
    const admin = await createAdmin();
    const { id } = await registerUser({ email: 'target2@example.com' });

    const res = await request(app)
      .patch(`/api/users/${id}/role`)
      .set('Cookie', admin.cookies)
      .send({ role: 'superuser' });

    expect(res.status).toBe(422);
  });

  it('returns 404 for a non-existent user id', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .patch('/api/users/64a000000000000000000001/role')
      .set('Cookie', admin.cookies)
      .send({ role: 'farm' });

    expect(res.status).toBe(404);
  });

  it('returns 403 for a non-admin user', async () => {
    const { cookies } = await registerUser({ email: 'other@example.com' });
    const { id } = await registerUser({ email: 'target3@example.com' });

    const res = await request(app)
      .patch(`/api/users/${id}/role`)
      .set('Cookie', cookies)
      .send({ role: 'farm' });

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .patch('/api/users/64a000000000000000000001/role')
      .send({ role: 'farm' });
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────

describe('DELETE /api/users/:id', () => {
  it('allows an admin to delete another user', async () => {
    const admin = await createAdmin();
    const { id } = await registerUser({ email: 'todelete@example.com' });

    const res = await request(app)
      .delete(`/api/users/${id}`)
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(200);

    // Confirm user no longer in the list
    const list = await request(app).get('/api/users').set('Cookie', admin.cookies);
    expect(list.body.find((u) => u._id === id)).toBeUndefined();
  });

  it('returns 403 when an admin tries to delete themselves', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .delete(`/api/users/${admin.id}`)
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent user id', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .delete('/api/users/64a000000000000000000001')
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(404);
  });

  it('returns 403 for a non-admin user', async () => {
    const { cookies } = await registerUser({ email: 'attacker@example.com' });
    const { id } = await registerUser({ email: 'victim@example.com' });

    const res = await request(app)
      .delete(`/api/users/${id}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).delete('/api/users/64a000000000000000000001');
    expect(res.status).toBe(401);
  });
});
