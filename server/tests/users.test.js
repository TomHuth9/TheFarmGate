const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { connectTestDB, disconnectTestDB, clearDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterAll(disconnectTestDB);
afterEach(clearDB);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Creates a pre-verified user directly in the DB (bypasses the register
// endpoint and its email-verification flow) so other tests can get a login
// cookie without triggering the verification block.
async function createVerifiedUser(overrides = {}) {
  const defaults = {
    name: 'Alice',
    email: 'alice@example.com',
    password: 'password123',
  };
  return User.create({ ...defaults, ...overrides, emailVerified: true });
}

async function loginAndGetCookies(email = 'alice@example.com', password = 'password123') {
  const res = await request(app).post('/api/users/login').send({ email, password });
  return res.headers['set-cookie'];
}

async function createVerifiedUserAndGetCookies(overrides = {}) {
  await createVerifiedUser(overrides);
  return loginAndGetCookies(
    overrides.email || 'alice@example.com',
    overrides.password || 'password123',
  );
}

// ── POST /api/users/register ──────────────────────────────────────────────────

describe('POST /api/users/register', () => {
  it('returns requiresVerification: true and no auth cookie', async () => {
    const res = await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.user).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('creates the user in the database with emailVerified: false', async () => {
    await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });

    const user = await User.findOne({ email: 'alice@example.com' });
    expect(user).not.toBeNull();
    expect(user.emailVerified).toBe(false);
  });

  it('stores a hashed email verification token with a future expiry', async () => {
    await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });

    const user = await User.findOne({ email: 'alice@example.com' });
    expect(user.emailVerificationToken).toBeDefined();
    expect(user.emailVerificationExpires.getTime()).toBeGreaterThan(Date.now());
  });

  it('does not store the plaintext token (stores a SHA-256 hash)', async () => {
    await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });

    const user = await User.findOne({ email: 'alice@example.com' });
    // The stored token should be a 64-char hex SHA-256 hash, not a raw random value
    expect(user.emailVerificationToken).toMatch(/^[0-9a-f]{64}$/);
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
    expect(res.body.requiresVerification).toBe(true);

    const user = await User.findOne({ email: 'bob@farm.com' });
    expect(user.role).toBe('farm');
    expect(user.farmName).toBe('Sunny Acres');
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

    expect(res.status).toBe(422);
  });
});

// ── GET /api/users/verify-email/:token ────────────────────────────────────────

describe('GET /api/users/verify-email/:token', () => {
  const RAW_TOKEN = 'c'.repeat(64);
  const HASHED_TOKEN = crypto.createHash('sha256').update(RAW_TOKEN).digest('hex');
  let userId;

  beforeEach(async () => {
    const user = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
      emailVerified: false,
      emailVerificationToken: HASHED_TOKEN,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    userId = user.id;
  });

  it('returns 200 and a success message for a valid token', async () => {
    const res = await request(app).get(`/api/users/verify-email/${RAW_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/verified/i);
  });

  it('sets emailVerified to true and clears token fields', async () => {
    await request(app).get(`/api/users/verify-email/${RAW_TOKEN}`);

    const user = await User.findById(userId);
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerificationToken).toBeUndefined();
    expect(user.emailVerificationExpires).toBeUndefined();
  });

  it('allows the user to log in after email verification', async () => {
    await request(app).get(`/api/users/verify-email/${RAW_TOKEN}`);

    const login = await request(app)
      .post('/api/users/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeDefined();
    expect(login.body.user.email).toBe('alice@example.com');
  });

  it('returns 400 for an expired token', async () => {
    await User.findByIdAndUpdate(userId, {
      emailVerificationExpires: new Date(Date.now() - 1000),
    });

    const res = await request(app).get(`/api/users/verify-email/${RAW_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('returns 400 for an unknown token', async () => {
    const unknownToken = 'd'.repeat(64);
    const res = await request(app).get(`/api/users/verify-email/${unknownToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('returns 422 for a malformed (non-hex) token', async () => {
    const res = await request(app).get('/api/users/verify-email/not-a-valid-token');

    expect(res.status).toBe(422);
  });

  it('returns 400 when the token is used a second time', async () => {
    await request(app).get(`/api/users/verify-email/${RAW_TOKEN}`);
    const res = await request(app).get(`/api/users/verify-email/${RAW_TOKEN}`);

    expect(res.status).toBe(400);
  });
});

// ── POST /api/users/login ─────────────────────────────────────────────────────

describe('POST /api/users/login — verified user', () => {
  beforeEach(async () => {
    await createVerifiedUser();
  });

  it('sets an auth cookie on valid credentials', async () => {
    const res = await request(app).post('/api/users/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
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

describe('POST /api/users/login — unverified user', () => {
  beforeEach(async () => {
    await request(app).post('/api/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
  });

  it('returns requiresVerification: true and no cookie', async () => {
    const res = await request(app).post('/api/users/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.user).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('refreshes the email verification token on each unverified login attempt', async () => {
    const before = await User.findOne({ email: 'alice@example.com' });
    const tokenBefore = before.emailVerificationToken;

    await request(app).post('/api/users/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });

    const after = await User.findOne({ email: 'alice@example.com' });
    expect(after.emailVerificationToken).toBeDefined();
    expect(after.emailVerificationToken).not.toBe(tokenBefore);
  });

  it('still returns 401 for wrong password even when unverified', async () => {
    const res = await request(app).post('/api/users/login').send({
      email: 'alice@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
  });
});

// ── POST /api/users/forgot-password ──────────────────────────────────────────

describe('POST /api/users/forgot-password', () => {
  beforeEach(async () => {
    // Unverified user is fine here — forgot-password does not check emailVerified
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

// ── POST /api/users/reset-password/:token ────────────────────────────────────

describe('POST /api/users/reset-password/:token', () => {
  let userId;
  const RAW_TOKEN = 'a'.repeat(64);

  beforeEach(async () => {
    // Create a pre-verified user so login works after password reset
    const user = await createVerifiedUser();
    userId = user.id;

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
    expect(login.headers['set-cookie']).toBeDefined();
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

// ── PATCH /api/users/me ───────────────────────────────────────────────────────

describe('PATCH /api/users/me', () => {
  it('allows a farm to update farmName, farmDescription, and farmLocation', async () => {
    const cookies = await createVerifiedUserAndGetCookies({
      role: 'farm',
      farmName: 'Old Farm',
      farmLocation: 'Devon',
    });

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', cookies)
      .send({
        name: 'Alice Updated',
        farmName: 'New Farm',
        farmDescription: 'We raise happy cows.',
        farmLocation: 'Yorkshire, UK',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice Updated');
    expect(res.body.farmName).toBe('New Farm');
    expect(res.body.farmDescription).toBe('We raise happy cows.');
    expect(res.body.farmLocation).toBe('Yorkshire, UK');
    expect(res.body).not.toHaveProperty('password');
  });

  it('allows a customer to update their name', async () => {
    const cookies = await createVerifiedUserAndGetCookies();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', cookies)
      .send({ name: 'Alice Updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice Updated');
  });

  it('silently ignores farm fields for a customer', async () => {
    const cookies = await createVerifiedUserAndGetCookies();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', cookies)
      .send({ name: 'Alice', farmName: 'Hacker Farm' });

    expect(res.status).toBe(200);
    expect(res.body.farmName).toBeFalsy();
  });

  it('returns 422 when name is set to an empty string', async () => {
    const cookies = await createVerifiedUserAndGetCookies();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', cookies)
      .send({ name: '' });

    expect(res.status).toBe(422);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .send({ name: 'Nobody' });

    expect(res.status).toBe(401);
  });
});

// ── GET /api/users/me ─────────────────────────────────────────────────────────

describe('GET /api/users/me', () => {
  it('returns the user profile for a valid cookie', async () => {
    const cookies = await createVerifiedUserAndGetCookies();

    const res = await request(app)
      .get('/api/users/me')
      .set('Cookie', cookies);

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
