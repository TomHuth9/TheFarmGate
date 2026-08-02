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

describe('GET /api/products', () => {
  it('returns an empty array when no products exist', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('filters by category', async () => {
    const { cookies } = await createFarm();

    await request(app)
      .post('/api/products')
      .set('Cookie', cookies)
      .send({ name: 'Milk', description: 'Fresh milk', price: 1.5, category: 'Dairy', unit: 'per litre' });

    await request(app)
      .post('/api/products')
      .set('Cookie', cookies)
      .send({ name: 'Steak', description: 'Fine ribeye steak', price: 18, category: 'Beef', unit: 'per 300g' });

    const res = await request(app).get('/api/products?category=Dairy');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('Dairy');
  });

  it('filters by farm id', async () => {
    const farm1 = await createFarm({ email: 'farm1@example.com', farmName: 'Farm One' });
    const farm2 = await createFarm({ email: 'farm2@example.com', farmName: 'Farm Two' });

    await request(app)
      .post('/api/products')
      .set('Cookie', farm1.cookies)
      .send({ name: 'Milk', description: 'Fresh organic', price: 1.5, category: 'Dairy', unit: 'per litre' });

    await request(app)
      .post('/api/products')
      .set('Cookie', farm2.cookies)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app).get(`/api/products?farm=${farm1.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Milk');
  });

  describe('?q search', () => {
    let cookies;

    beforeEach(async () => {
      ({ cookies } = await createFarm());
      await request(app).post('/api/products').set('Cookie', cookies)
        .send({ name: 'Organic Whole Milk', description: 'Rich creamy milk from grass-fed cows', price: 1.5, category: 'Dairy', unit: 'per litre' });
      await request(app).post('/api/products').set('Cookie', cookies)
        .send({ name: 'Free Range Eggs', description: 'Laid by happy hens', price: 3, category: 'Eggs', unit: 'per dozen' });
      await request(app).post('/api/products').set('Cookie', cookies)
        .send({ name: 'Ribeye Steak', description: 'Premium grass-fed beef', price: 18, category: 'Beef', unit: 'per 300g' });
    });

    it('matches products by name (case-insensitive)', async () => {
      const res = await request(app).get('/api/products?q=eggs');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Free Range Eggs');
    });

    it('matches products by description keyword', async () => {
      const res = await request(app).get('/api/products?q=grass-fed');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('returns all matching products for a partial name', async () => {
      const res = await request(app).get('/api/products?q=mil');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Organic Whole Milk');
    });

    it('returns an empty array when nothing matches', async () => {
      const res = await request(app).get('/api/products?q=unicorn');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('can combine ?q with ?category', async () => {
      const res = await request(app).get('/api/products?q=grass-fed&category=Dairy');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Organic Whole Milk');
    });

    it('returns 422 when ?q exceeds 100 characters', async () => {
      const long = 'a'.repeat(101);
      const res = await request(app).get(`/api/products?q=${long}`);
      expect(res.status).toBe(422);
    });
  });
});

describe('GET /api/products/:id', () => {
  it('returns a single product with farm info populated', async () => {
    const { cookies } = await createFarm();

    const created = await request(app)
      .post('/api/products')
      .set('Cookie', cookies)
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
    const { cookies } = await createFarm();

    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookies)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Eggs');
    expect(res.body.farm).toBeDefined(); // auto-assigned to the farm
  });

  it('returns 403 for a customer', async () => {
    const { cookies } = await createUser();

    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookies)
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
    const { cookies } = await createFarm();

    const created = await request(app)
      .post('/api/products')
      .set('Cookie', cookies)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app)
      .put(`/api/products/${created.body._id}`)
      .set('Cookie', cookies)
      .send({ price: 3.50 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(3.50);
  });

  it("returns 403 when a farm tries to edit another farm's product", async () => {
    const farm1 = await createFarm({ email: 'f1@example.com', farmName: 'Farm 1' });
    const farm2 = await createFarm({ email: 'f2@example.com', farmName: 'Farm 2' });

    const created = await request(app)
      .post('/api/products')
      .set('Cookie', farm1.cookies)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app)
      .put(`/api/products/${created.body._id}`)
      .set('Cookie', farm2.cookies)
      .send({ price: 99 });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/products/:id', () => {
  it('allows a farm to delete its own product', async () => {
    const { cookies } = await createFarm();

    const created = await request(app)
      .post('/api/products')
      .set('Cookie', cookies)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app)
      .delete(`/api/products/${created.body._id}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);

    // Confirm it's gone
    const check = await request(app).get(`/api/products/${created.body._id}`);
    expect(check.status).toBe(404);
  });

  it("returns 403 when a farm tries to delete another farm's product", async () => {
    const farm1 = await createFarm({ email: 'f1@example.com', farmName: 'Farm 1' });
    const farm2 = await createFarm({ email: 'f2@example.com', farmName: 'Farm 2' });

    const created = await request(app)
      .post('/api/products')
      .set('Cookie', farm1.cookies)
      .send({ name: 'Eggs', description: 'Free range', price: 3, category: 'Eggs', unit: 'per dozen' });

    const res = await request(app)
      .delete(`/api/products/${created.body._id}`)
      .set('Cookie', farm2.cookies);

    expect(res.status).toBe(403);
  });
});
