const request = require('supertest');
const app = require('../app');
const { connectTestDB, disconnectTestDB, clearDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterAll(disconnectTestDB);
afterEach(clearDB);

// Helper: register a user and return token + id
async function registerUser(overrides = {}) {
  const defaults = {
    name: 'Test User',
    email: `user_${Date.now()}@example.com`,
    password: 'password123',
  };
  const res = await request(app)
    .post('/api/users/register')
    .send({ ...defaults, ...overrides });
  return { token: res.body.token, id: res.body.user.id };
}

// Helper: register a farm account and return token + id
async function registerFarm(overrides = {}) {
  return registerUser({
    name: 'Farm Owner',
    email: `farm_${Date.now()}@example.com`,
    password: 'password123',
    role: 'farm',
    farmName: 'Test Farm',
    farmLocation: 'Yorkshire, UK',
    ...overrides,
  });
}

describe('GET /api/products', () => {
  it('returns an empty array when no products exist', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('filters by category', async () => {
    const { token } = await registerFarm();

    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Milk', description: 'Fresh milk', price: 1.5, category: 'Dairy', unit: 'per litre' });

    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Steak', description: 'Fine ribeye steak', price: 18, category: 'Beef', unit: 'per 300g' });

    const res = await request(app).get('/api/products?category=Dairy');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('Dairy');
  });

  it('filters by farm id', async () => {
    const farm1 = await registerFarm({ email: 'farm1@example.com', farmName: 'Farm One' });
    const farm2 = await registerFarm({ email: 'farm2@example.com', farmName: 'Farm Two' });

    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farm1.token}`)
      .send({ name: 'Milk', description: 'Fresh organic', price: 1.5, category: 'Dairy', unit: 'per litre' });

    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farm2.token}`)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app).get(`/api/products?farm=${farm1.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Milk');
  });
});

describe('GET /api/products/:id', () => {
  it('returns a single product with farm info populated', async () => {
    const { token } = await registerFarm();

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Milk', description: 'Fresh organic', price: 1.5, category: 'Dairy', unit: 'per litre' });

    const res = await request(app).get(`/api/products/${created.body._id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Milk');
    expect(res.body.farm).toBeDefined();
    expect(res.body.farm.farmName).toBe('Test Farm');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/products/64a000000000000000000001');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/products', () => {
  it('allows a farm to create a product', async () => {
    const { token } = await registerFarm();

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Eggs');
    expect(res.body.farm).toBeDefined(); // auto-assigned to the farm
  });

  it('returns 403 for a customer', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/products/:id', () => {
  it('allows a farm to edit its own product', async () => {
    const { token } = await registerFarm();

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app)
      .put(`/api/products/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 3.50 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(3.50);
  });

  it("returns 403 when a farm tries to edit another farm's product", async () => {
    const farm1 = await registerFarm({ email: 'f1@example.com', farmName: 'Farm 1' });
    const farm2 = await registerFarm({ email: 'f2@example.com', farmName: 'Farm 2' });

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farm1.token}`)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app)
      .put(`/api/products/${created.body._id}`)
      .set('Authorization', `Bearer ${farm2.token}`)
      .send({ price: 99 });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/products/:id', () => {
  it('allows a farm to delete its own product', async () => {
    const { token } = await registerFarm();

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app)
      .delete(`/api/products/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Confirm it's gone
    const check = await request(app).get(`/api/products/${created.body._id}`);
    expect(check.status).toBe(404);
  });

  it("returns 403 when a farm tries to delete another farm's product", async () => {
    const farm1 = await registerFarm({ email: 'f1@example.com', farmName: 'Farm 1' });
    const farm2 = await registerFarm({ email: 'f2@example.com', farmName: 'Farm 2' });

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farm1.token}`)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app)
      .delete(`/api/products/${created.body._id}`)
      .set('Authorization', `Bearer ${farm2.token}`);

    expect(res.status).toBe(403);
  });
});
