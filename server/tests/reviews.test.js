const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { connectTestDB, disconnectTestDB, clearDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterAll(disconnectTestDB);
afterEach(clearDB);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createUser(overrides = {}) {
  const defaults = {
    name: 'Test Customer',
    email: `user_${Date.now()}@example.com`,
    password: 'password123',
    role: 'customer',
  };
  const merged = { ...defaults, ...overrides };
  await User.create({ ...merged, emailVerified: true });
  const loginRes = await request(app)
    .post('/api/users/login')
    .send({ email: merged.email, password: merged.password });
  return { cookies: loginRes.headers['set-cookie'], email: merged.email };
}

async function createFarm() {
  const merged = {
    name: 'Test Farm',
    email: `farm_${Date.now()}@example.com`,
    password: 'password123',
    role: 'farm',
    farmName: 'Test Farm',
  };
  await User.create({ ...merged, emailVerified: true });
  const loginRes = await request(app)
    .post('/api/users/login')
    .send({ email: merged.email, password: merged.password });
  return { cookies: loginRes.headers['set-cookie'] };
}

async function createProduct(farmCookies) {
  const res = await request(app)
    .post('/api/products')
    .set('Cookie', farmCookies)
    .send({
      name: 'Test Cheese',
      description: 'A delicious aged cheese',
      price: 6.5,
      category: 'Dairy',
      unit: 'per 300g',
    });
  return res.body;
}

const deliveryAddress = { line1: '1 Test Lane', city: 'London', postcode: 'SW1 1AA' };

async function placeOrder(customerCookies, productId) {
  const res = await request(app)
    .post('/api/orders')
    .set('Cookie', customerCookies)
    .send({ items: [{ product: productId, quantity: 1 }], deliveryAddress });
  return res.body;
}

async function advanceOrder(orderId, status, actorCookies) {
  return request(app)
    .patch(`/api/orders/${orderId}/status`)
    .set('Cookie', actorCookies)
    .send({ status });
}

// Sets up a product with one eligible customer (order in 'confirmed' state)
async function setupReviewable() {
  const farm = await createFarm();
  const product = await createProduct(farm.cookies);
  const customer = await createUser();
  const order = await placeOrder(customer.cookies, product._id);
  await advanceOrder(order._id, 'confirmed', farm.cookies);
  return { farm, product, customer };
}

// ─── GET /api/products/:id/reviews ───────────────────────────────────────────

describe('GET /api/products/:id/reviews', () => {
  it('returns 200 with an empty reviews array for a new product', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);

    const res = await request(app).get(`/api/products/${product._id}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([]);
    expect(res.body.count).toBe(0);
    expect(res.body.avgRating).toBeNull();
  });

  it('returns a review with the reviewer name populated', async () => {
    const { product, customer } = await setupReviewable();

    await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 5, body: 'Excellent cheese.' });

    const res = await request(app).get(`/api/products/${product._id}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].rating).toBe(5);
    expect(res.body.reviews[0].body).toBe('Excellent cheese.');
    expect(res.body.reviews[0].user.name).toBe('Test Customer');
    expect(res.body.reviews[0].user.password).toBeUndefined();
  });

  it('returns correct aggregate stats after a review is submitted', async () => {
    const { product, customer } = await setupReviewable();

    await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 4 });

    const res = await request(app).get(`/api/products/${product._id}/reviews`);

    expect(res.body.count).toBe(1);
    expect(res.body.avgRating).toBeCloseTo(4);
    expect(res.body.total).toBe(1);
  });

  it('returns 422 for an invalid product id format', async () => {
    const res = await request(app).get('/api/products/not-an-id/reviews');
    expect(res.status).toBe(422);
  });

  it('returns an empty list (not 404) for a valid id with no reviews', async () => {
    const res = await request(app).get('/api/products/64a000000000000000000001/reviews');
    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([]);
  });

  it('sorts reviews newest first', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer1 = await createUser({ email: 'c1@ex.com' });
    const customer2 = await createUser({ email: 'c2@ex.com' });

    for (const c of [customer1, customer2]) {
      const order = await placeOrder(c.cookies, product._id);
      await advanceOrder(order._id, 'confirmed', farm.cookies);
    }

    await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer1.cookies)
      .send({ rating: 3, body: 'Older review' });

    await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer2.cookies)
      .send({ rating: 5, body: 'Newer review' });

    const res = await request(app).get(`/api/products/${product._id}/reviews`);

    expect(res.body.reviews[0].body).toBe('Newer review');
    expect(res.body.reviews[1].body).toBe('Older review');
  });
});

// ─── POST /api/products/:id/reviews ──────────────────────────────────────────

describe('POST /api/products/:id/reviews', () => {
  it('returns 201 with the created review', async () => {
    const { product, customer } = await setupReviewable();

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 4, body: 'Really good.' });

    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(4);
    expect(res.body.body).toBe('Really good.');
    expect(res.body.user.name).toBe('Test Customer');
  });

  it('allows a review with no body (rating only)', async () => {
    const { product, customer } = await setupReviewable();

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 5 });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe('');
  });

  it('returns 401 when not authenticated', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .send({ rating: 4 });

    expect(res.status).toBe(401);
  });

  it('returns 403 for farm accounts', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', farm.cookies)
      .send({ rating: 3 });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/customer/i);
  });

  it('returns 403 for admin accounts', async () => {
    const admin = await createUser({ role: 'admin', email: 'admin@ex.com' });
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', admin.cookies)
      .send({ rating: 5 });

    expect(res.status).toBe(403);
  });

  it('returns 403 when the customer has not purchased the product', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 4 });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/purchased/i);
  });

  it('returns 403 when the order is still pending (not yet confirmed)', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();
    await placeOrder(customer.cookies, product._id);
    // Order is still 'pending' — not confirmed

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 3 });

    expect(res.status).toBe(403);
  });

  it('returns 403 for a cancelled order', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();
    const order = await placeOrder(customer.cookies, product._id);
    await advanceOrder(order._id, 'cancelled', customer.cookies);

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 2 });

    expect(res.status).toBe(403);
  });

  it('allows a review after the order is dispatched', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();
    const order = await placeOrder(customer.cookies, product._id);
    await advanceOrder(order._id, 'confirmed', farm.cookies);
    await advanceOrder(order._id, 'dispatched', farm.cookies);

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 5, body: 'Arrived quickly.' });

    expect(res.status).toBe(201);
  });

  it('returns 409 when the same customer reviews the same product twice', async () => {
    const { product, customer } = await setupReviewable();

    await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 4 });

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 5 });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already reviewed/i);
  });

  it('returns 422 when rating is missing', async () => {
    const { product, customer } = await setupReviewable();

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ body: 'No rating here.' });

    expect(res.status).toBe(422);
  });

  it('returns 422 when rating is 0', async () => {
    const { product, customer } = await setupReviewable();

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 0 });

    expect(res.status).toBe(422);
  });

  it('returns 422 when rating exceeds 5', async () => {
    const { product, customer } = await setupReviewable();

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 6 });

    expect(res.status).toBe(422);
  });

  it('returns 422 when body exceeds 500 characters', async () => {
    const { product, customer } = await setupReviewable();

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 3, body: 'x'.repeat(501) });

    expect(res.status).toBe(422);
  });

  it('allows body of exactly 500 characters', async () => {
    const { product, customer } = await setupReviewable();

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', customer.cookies)
      .send({ rating: 3, body: 'x'.repeat(500) });

    expect(res.status).toBe(201);
  });

  it('allows two different customers to each review the same product', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const c1 = await createUser({ email: 'c1@ex.com' });
    const c2 = await createUser({ email: 'c2@ex.com' });

    for (const c of [c1, c2]) {
      const order = await placeOrder(c.cookies, product._id);
      await advanceOrder(order._id, 'confirmed', farm.cookies);
    }

    const r1 = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', c1.cookies)
      .send({ rating: 4 });

    const r2 = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .set('Cookie', c2.cookies)
      .send({ rating: 2 });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });
});
