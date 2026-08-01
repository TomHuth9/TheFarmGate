jest.mock('../utils/email', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
  sendOrderReceived: jest.fn().mockResolvedValue(undefined),
  sendStatusUpdate: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const app = require('../app');
const email = require('../utils/email');
const { connectTestDB, disconnectTestDB, clearDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterAll(disconnectTestDB);
afterEach(async () => {
  await clearDB();
  jest.clearAllMocks();
});

const deliveryAddress = { line1: '1 Farm Road', city: 'London', postcode: 'SW1 1AA' };

async function registerUser(overrides = {}) {
  const defaults = {
    name: 'Test Customer',
    email: `customer_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
    password: 'password123',
  };
  const payload = { ...defaults, ...overrides };
  const res = await request(app).post('/api/users/register').send(payload);
  return { cookies: res.headers['set-cookie'], id: res.body.user?.id, email: payload.email };
}

async function registerFarm() {
  const farmEmail = `farm_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/users/register').send({
    name: 'Farm Owner',
    email: farmEmail,
    password: 'password123',
    role: 'farm',
    farmName: 'Green Acres',
    farmLocation: 'Yorkshire, UK',
  });
  return { cookies: res.headers['set-cookie'], id: res.body.user?.id, email: farmEmail };
}

async function createProduct(cookies) {
  const res = await request(app)
    .post('/api/products')
    .set('Cookie', cookies)
    .send({ name: 'Organic Milk', description: 'Fresh milk', price: 1.5, category: 'Dairy', unit: 'per litre' });
  return res.body;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── POST /api/orders ─────────────────────────────────────────────────────────

describe('POST /api/orders — email notifications', () => {
  it('sends an order confirmation email to the customer', async () => {
    const farm = await registerFarm();
    const product = await createProduct(farm.cookies);
    const customer = await registerUser();

    await request(app)
      .post('/api/orders')
      .set('Cookie', customer.cookies)
      .send({ items: [{ product: product._id, quantity: 1 }], deliveryAddress })
      .expect(201);

    await wait(300); // let the fire-and-forget DB queries complete

    expect(email.sendOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ email: customer.email }),
      expect.objectContaining({ total: expect.any(Number) })
    );
  });

  it('sends a farm notification email to the farm that owns the product', async () => {
    const farm = await registerFarm();
    const product = await createProduct(farm.cookies);
    const customer = await registerUser();

    await request(app)
      .post('/api/orders')
      .set('Cookie', customer.cookies)
      .send({ items: [{ product: product._id, quantity: 1 }], deliveryAddress })
      .expect(201);

    await wait(300);

    expect(email.sendOrderReceived).toHaveBeenCalledWith(
      expect.objectContaining({ email: farm.email }),
      expect.any(Array),
      expect.objectContaining({ total: expect.any(Number) })
    );
  });
});

// ─── PATCH /api/orders/:id/status ─────────────────────────────────────────────

describe('PATCH /api/orders/:id/status — email notifications', () => {
  it('sends a status update email to the customer when the order status changes', async () => {
    const farm = await registerFarm();
    const product = await createProduct(farm.cookies);
    const customer = await registerUser();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', customer.cookies)
      .send({ items: [{ product: product._id, quantity: 1 }], deliveryAddress })
      .expect(201);

    await wait(300); // let order-placed emails fire
    jest.clearAllMocks(); // only care about the status-update call below

    await request(app)
      .patch(`/api/orders/${orderRes.body._id}/status`)
      .set('Cookie', farm.cookies)
      .send({ status: 'confirmed' })
      .expect(200);

    await wait(300);

    expect(email.sendStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ email: customer.email }),
      expect.objectContaining({ status: 'confirmed' })
    );
  });

  it('does not send a status update email when the update fails', async () => {
    const farm = await registerFarm();
    const product = await createProduct(farm.cookies);
    const customer = await registerUser();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', customer.cookies)
      .send({ items: [{ product: product._id, quantity: 1 }], deliveryAddress })
      .expect(201);

    await wait(300);
    jest.clearAllMocks();

    // Try an invalid transition: pending → delivered (not allowed)
    await request(app)
      .patch(`/api/orders/${orderRes.body._id}/status`)
      .set('Cookie', farm.cookies)
      .send({ status: 'delivered' })
      .expect(422);

    await wait(300);

    expect(email.sendStatusUpdate).not.toHaveBeenCalled();
  });
});
