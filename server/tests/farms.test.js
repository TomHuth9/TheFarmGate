const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { connectTestDB, disconnectTestDB, clearDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterAll(disconnectTestDB);
afterEach(clearDB);

async function createFarm(overrides = {}) {
  const defaults = {
    name: 'Farm Owner',
    email: `farm_${Date.now()}@example.com`,
    password: 'password123',
    role: 'farm',
    farmName: 'Green Acres',
    farmDescription: 'A family farm in the hills.',
    farmLocation: 'Herefordshire, UK',
  };
  const merged = { ...defaults, ...overrides };
  const user = await User.create({ ...merged, emailVerified: true });
  const loginRes = await request(app).post('/api/users/login').send({ email: merged.email, password: merged.password });
  return { cookies: loginRes.headers['set-cookie'], id: user.id };
}

describe('GET /api/farms', () => {
  it('returns an empty array when no farms exist', async () => {
    const res = await request(app).get('/api/farms');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('lists all registered farms', async () => {
    await createFarm({ email: 'farm1@example.com', farmName: 'Farm One' });
    await createFarm({ email: 'farm2@example.com', farmName: 'Farm Two' });

    const res = await request(app).get('/api/farms');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((f) => f.farmName)).toEqual(
      expect.arrayContaining(['Farm One', 'Farm Two'])
    );
  });

  it('does not expose passwords in the response', async () => {
    await createFarm();
    const res = await request(app).get('/api/farms');
    expect(res.body[0]).not.toHaveProperty('password');
  });

  it('includes the postcode field when a farm has one', async () => {
    await createFarm({ postcode: 'HE1 1AA' });
    const res = await request(app).get('/api/farms');
    expect(res.status).toBe(200);
    expect(res.body[0].postcode).toBe('HE1 1AA');
  });

  it('omits the postcode field when a farm was registered without one', async () => {
    await createFarm(); // no postcode override
    const res = await request(app).get('/api/farms');
    expect(res.body[0]).not.toHaveProperty('postcode');
  });
});

describe('GET /api/farms/:id', () => {
  it('returns the farm profile and its products', async () => {
    const { cookies, id } = await createFarm();

    await request(app)
      .post('/api/products')
      .set('Cookie', cookies)
      .send({ name: 'Free-Range Eggs', description: 'Lovely eggs', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app).get(`/api/farms/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.farm.farmName).toBe('Green Acres');
    expect(res.body.farm.farmLocation).toBe('Herefordshire, UK');
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Free-Range Eggs');
  });

  it('returns an empty products array when the farm has no products', async () => {
    const { id } = await createFarm();
    const res = await request(app).get(`/api/farms/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });

  it('returns 404 for a non-existent farm id', async () => {
    const res = await request(app).get('/api/farms/64a000000000000000000001');
    expect(res.status).toBe(404);
  });

  it('returns 404 when the id belongs to a customer, not a farm', async () => {
    const customer = await User.create({
      name: 'Customer',
      email: 'customer@example.com',
      password: 'password123',
      emailVerified: true,
    });

    const check = await request(app).get(`/api/farms/${customer.id}`);
    expect(check.status).toBe(404);
  });
});
