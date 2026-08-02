const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { connectTestDB, disconnectTestDB, clearDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterAll(disconnectTestDB);
afterEach(clearDB);

async function createUser(overrides = {}) {
  const defaults = {
    name: 'Test User',
    email: `user_${Date.now()}@example.com`,
    password: 'password123',
  };
  const merged = { ...defaults, ...overrides };
  const user = await User.create({ ...merged, emailVerified: true });
  const loginRes = await request(app).post('/api/users/login').send({ email: merged.email, password: merged.password });
  return { cookies: loginRes.headers['set-cookie'], id: user.id };
}

// Admin accounts cannot be created via the public register endpoint,
// so we insert directly into the DB and promote the role before login.
async function createAdmin(email = `admin_${Date.now()}@example.com`) {
  const user = await User.create({ name: 'Admin', email, password: 'password123', emailVerified: true });
  await User.findByIdAndUpdate(user.id, { role: 'admin' });
  const loginRes = await request(app).post('/api/users/login').send({ email, password: 'password123' });
  return { cookies: loginRes.headers['set-cookie'], id: user.id };
}

async function createFarm(overrides = {}) {
  return createUser({
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
    await createUser({ email: 'customer@example.com' });
    await createFarm({ email: 'farm@example.com' });

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
    const { cookies } = await createUser();
    const res = await request(app).get('/api/users').set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('returns 403 for a farm user', async () => {
    const { cookies } = await createFarm();
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
    const { id } = await createUser({ email: 'target@example.com' });

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
    const { id } = await createUser({ email: 'target2@example.com' });

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
    const { cookies } = await createUser({ email: 'other@example.com' });
    const { id } = await createUser({ email: 'target3@example.com' });

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
    const { id } = await createUser({ email: 'todelete@example.com' });

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
    const { cookies } = await createUser({ email: 'attacker@example.com' });
    const { id } = await createUser({ email: 'victim@example.com' });

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
