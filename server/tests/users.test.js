const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
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

describe('POST /api/users/forgot-password', () => {
  beforeEach(async () => {
    await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
  });

  it('returns 200 and a success message for a registered email', async () => {
    const res = await request(app)
      .post('/api/users/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link/i);
  });

  it('returns 200 for an unregistered email — does not reveal whether account exists', async () => {
    const res = await request(app)
      .post('/api/users/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link/i);
  });

  it('returns 422 for an invalid email format', async () => {
    const res = await request(app)
      .post('/api/users/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
  });

  it('stores a hashed reset token and expiry on the user', async () => {
    await request(app)
      .post('/api/users/forgot-password')
      .send({ email: 'alice@example.com' });

    const user = await User.findOne({ email: 'alice@example.com' });
    expect(user.resetPasswordToken).toBeDefined();
    expect(user.resetPasswordExpires).toBeDefined();
    expect(user.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('POST /api/users/reset-password/:token', () => {
  let userId;
  const RAW_TOKEN = 'a'.repeat(64); // 64 hex chars = 32 bytes

  beforeEach(async () => {
    const reg = await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    userId = reg.body.user.id;

    // Directly write a known hashed token into the DB
    const hashedToken = crypto.createHash('sha256').update(RAW_TOKEN).digest('hex');
    await User.findByIdAndUpdate(userId, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
    });
  });

  it('resets the password and returns 200', async () => {
    const res = await request(app)
      .post(`/api/users/reset-password/${RAW_TOKEN}`)
      .send({ password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });

  it('allows login with the new password after reset', async () => {
    await request(app)
      .post(`/api/users/reset-password/${RAW_TOKEN}`)
      .send({ password: 'newpassword123' });

    const login = await request(app)
      .post('/api/users/login')
      .send({ email: 'alice@example.com', password: 'newpassword123' });

    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });

  it('rejects the old password after reset', async () => {
    await request(app)
      .post(`/api/users/reset-password/${RAW_TOKEN}`)
      .send({ password: 'newpassword123' });

    const login = await request(app)
      .post('/api/users/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(login.status).toBe(401);
  });

  it('clears the reset token fields after a successful reset', async () => {
    await request(app)
      .post(`/api/users/reset-password/${RAW_TOKEN}`)
      .send({ password: 'newpassword123' });

    const user = await User.findById(userId);
    expect(user.resetPasswordToken).toBeUndefined();
    expect(user.resetPasswordExpires).toBeUndefined();
  });

  it('returns 400 for an unknown token', async () => {
    const unknownToken = 'b'.repeat(64);
    const res = await request(app)
      .post(`/api/users/reset-password/${unknownToken}`)
      .send({ password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('returns 400 for an expired token', async () => {
    // Back-date the expiry
    await User.findByIdAndUpdate(userId, {
      resetPasswordExpires: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post(`/api/users/reset-password/${RAW_TOKEN}`)
      .send({ password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('returns 422 for a password shorter than 6 characters', async () => {
    const res = await request(app)
      .post(`/api/users/reset-password/${RAW_TOKEN}`)
      .send({ password: 'abc' });

    expect(res.status).toBe(422);
  });

  it('returns 422 for a malformed token', async () => {
    const res = await request(app)
      .post('/api/users/reset-password/not-a-valid-token')
      .send({ password: 'newpassword123' });

    expect(res.status).toBe(422);
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
