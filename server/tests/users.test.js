const request = require('supertest');
const app = require('../app');
const { connectTestDB, disconnectTestDB, clearDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterAll(disconnectTestDB);
afterEach(clearDB);

describe('POST /api/users/register', () => {
  it('creates a customer account and returns a JWT', async () => {
    const res = await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.role).toBe('customer');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('creates a farm account with farm profile fields', async () => {
    const res = await request(app).post('/api/users/register').send({
      name: 'Bob',
      email: 'bob@farm.com',
      password: 'password123',
      role: 'farm',
      farmName: 'Sunny Acres',
      farmLocation: 'Devon, UK',
      farmDescription: 'A lovely farm.',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('farm');
    expect(res.body.user.farmName).toBe('Sunny Acres');
  });

  it('returns 422 when farm name is missing for a farm registration', async () => {
    const res = await request(app).post('/api/users/register').send({
      name: 'Bob',
      email: 'bob@farm.com',
      password: 'password123',
      role: 'farm',
    });

    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => /farm name/i.test(e.message))).toBe(true);
  });

  it('returns 409 for a duplicate email', async () => {
    await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/users/register').send({
      name: 'Alice 2',
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(409);
  });

  it('rejects self-registration as admin with 422', async () => {
    const res = await request(app).post('/api/users/register').send({
      name: 'Hacker',
      email: 'hack@example.com',
      password: 'password123',
      role: 'admin',
    });

    expect(res.status).toBe(422); // 'admin' not in allowed roles ['customer', 'farm']
  });
});

describe('POST /api/users/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
  });

  it('returns a token on valid credentials', async () => {
    const res = await request(app).post('/api/users/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/users/login').send({
      email: 'alice@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/users/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/me', () => {
  it('returns the user profile for a valid token', async () => {
    const reg = await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    const { token } = reg.body;

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body).not.toHaveProperty('password');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});
