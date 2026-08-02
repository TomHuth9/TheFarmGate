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

async function createProduct(cookies, overrides = {}) {
  const res = await request(app)
    .post('/api/products')
    .set('Cookie', cookies)
    .send({
      name: 'Test Milk',
      description: 'Fresh organic milk',
      price: 1.5,
      category: 'Dairy',
      unit: 'per litre',
      ...overrides,
    });
  return res.body;
}

const deliveryAddress = { line1: '1 Farm Road', city: 'London', postcode: 'SW1 1AA' };

async function placeOrder(cookies, productId, overrides = {}) {
  const res = await request(app)
    .post('/api/orders')
    .set('Cookie', cookies)
    .send({
      items: [{ product: productId, quantity: 2 }],
      deliveryAddress,
      ...overrides,
    });
  return res.body;
}

// â”€â”€â”€ POST /api/orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('POST /api/orders', () => {
  it('creates an order and returns 201 with server-verified price', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const { cookies } = await createUser();

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ items: [{ product: product._id, quantity: 2 }], deliveryAddress });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.items[0].name).toBe('Test Milk');
    expect(res.body.total).toBeCloseTo(3.0);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ product: '64a000000000000000000001', quantity: 1 }], deliveryAddress });
    expect(res.status).toBe(401);
  });

  it('returns 422 when a product does not exist', async () => {
    const { cookies } = await createUser();
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ items: [{ product: '64a000000000000000000001', quantity: 1 }], deliveryAddress });
    expect(res.status).toBe(422);
  });

  it('returns 422 when delivery address is missing', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const { cookies } = await createUser();

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', cookies)
      .send({ items: [{ product: product._id, quantity: 1 }] });
    expect(res.status).toBe(422);
  });
});

// â”€â”€â”€ GET /api/orders/my â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('GET /api/orders/my', () => {
  it('returns the authenticated user\'s own orders', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();

    await placeOrder(customer.cookies, product._id);

    const res = await request(app)
      .get('/api/orders/my')
      .set('Cookie', customer.cookies);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('pending');
  });

  it('does not return another user\'s orders', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer1 = await createUser({ email: 'c1@example.com' });
    const customer2 = await createUser({ email: 'c2@example.com' });

    await placeOrder(customer1.cookies, product._id);

    const res = await request(app)
      .get('/api/orders/my')
      .set('Cookie', customer2.cookies);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/orders/my');
    expect(res.status).toBe(401);
  });
});

// â”€â”€â”€ GET /api/orders/farm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('GET /api/orders/farm', () => {
  it('returns orders containing the farm\'s products', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();

    await placeOrder(customer.cookies, product._id);

    const res = await request(app)
      .get('/api/orders/farm')
      .set('Cookie', farm.cookies);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].items[0].name).toBe('Test Milk');
    expect(res.body[0].user.email).toBeDefined();
  });

  it('returns an empty array when no orders contain the farm\'s products', async () => {
    const farm = await createFarm();

    const res = await request(app)
      .get('/api/orders/farm')
      .set('Cookie', farm.cookies);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('does not return orders for a different farm\'s products', async () => {
    const farm1 = await createFarm({ email: 'farm1@example.com', farmName: 'Farm 1' });
    const farm2 = await createFarm({ email: 'farm2@example.com', farmName: 'Farm 2' });
    const product = await createProduct(farm1.cookies);
    const customer = await createUser();

    await placeOrder(customer.cookies, product._id);

    const res = await request(app)
      .get('/api/orders/farm')
      .set('Cookie', farm2.cookies);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns 403 for a customer', async () => {
    const { cookies } = await createUser();
    const res = await request(app).get('/api/orders/farm').set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/orders/farm');
    expect(res.status).toBe(401);
  });
});

// â”€â”€â”€ PATCH /api/orders/:id/status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('PATCH /api/orders/:id/status', () => {
  it('allows a farm to update the status of an order containing its product', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();
    const order = await placeOrder(customer.cookies, product._id);

    const res = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Cookie', farm.cookies)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });

  it('advances through the full status workflow', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();
    const order = await placeOrder(customer.cookies, product._id);

    for (const status of ['confirmed', 'dispatched', 'delivered']) {
      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Cookie', farm.cookies)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it('returns 403 when the farm does not own any product in the order', async () => {
    const farm1 = await createFarm({ email: 'farm1@example.com', farmName: 'Farm 1' });
    const farm2 = await createFarm({ email: 'farm2@example.com', farmName: 'Farm 2' });
    const product = await createProduct(farm1.cookies);
    const customer = await createUser();
    const order = await placeOrder(customer.cookies, product._id);

    const res = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Cookie', farm2.cookies)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(403);
  });

  it('returns 422 for an invalid status value', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();
    const order = await placeOrder(customer.cookies, product._id);

    const res = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Cookie', farm.cookies)
      .send({ status: 'shipped' });

    expect(res.status).toBe(422);
  });

  it('returns 404 for a non-existent order id', async () => {
    const { cookies } = await createFarm();
    const res = await request(app)
      .patch('/api/orders/64a000000000000000000001/status')
      .set('Cookie', cookies)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(404);
  });

  it('returns 403 for a customer trying to confirm their own order', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();
    const order = await placeOrder(customer.cookies, product._id);

    const res = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Cookie', customer.cookies)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .patch('/api/orders/64a000000000000000000001/status')
      .send({ status: 'confirmed' });
    expect(res.status).toBe(401);
  });

  describe('customer cancellation', () => {
    it('allows a customer to cancel their own pending order', async () => {
      const farm = await createFarm();
      const product = await createProduct(farm.cookies);
      const customer = await createUser();
      const order = await placeOrder(customer.cookies, product._id);

      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Cookie', customer.cookies)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });

    it('returns 403 when the customer tries to cancel another user\'s order', async () => {
      const farm = await createFarm();
      const product = await createProduct(farm.cookies);
      const customer1 = await createUser({ email: 'c1@example.com' });
      const customer2 = await createUser({ email: 'c2@example.com' });
      const order = await placeOrder(customer1.cookies, product._id);

      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Cookie', customer2.cookies)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(403);
    });

    it('returns 422 when the customer tries to cancel a non-pending order', async () => {
      const farm = await createFarm();
      const product = await createProduct(farm.cookies);
      const customer = await createUser();
      const order = await placeOrder(customer.cookies, product._id);

      await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Cookie', farm.cookies)
        .send({ status: 'confirmed' });

      const res = await request(app)
        .patch(`/api/orders/${order._id}/status`)
        .set('Cookie', customer.cookies)
        .send({ status: 'cancelled' });

      expect(res.status).toBe(422);
    });
  });
});

// â”€â”€â”€ GET /api/orders/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('GET /api/orders/:id', () => {
  it('returns the order to its owner', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer = await createUser();
    const order = await placeOrder(customer.cookies, product._id);

    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', customer.cookies);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(order._id);
  });

  it('returns 403 when another customer requests the order', async () => {
    const farm = await createFarm();
    const product = await createProduct(farm.cookies);
    const customer1 = await createUser({ email: 'c1@example.com' });
    const customer2 = await createUser({ email: 'c2@example.com' });
    const order = await placeOrder(customer1.cookies, product._id);

    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', customer2.cookies);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent id', async () => {
    const { cookies } = await createUser();
    const res = await request(app)
      .get('/api/orders/64a000000000000000000001')
      .set('Cookie', cookies);
    expect(res.status).toBe(404);
  });
});

// â”€â”€â”€ GET /api/orders (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('GET /api/orders', () => {
  it('returns 403 for a customer', async () => {
    const { cookies } = await createUser();
    const res = await request(app).get('/api/orders').set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });
});
