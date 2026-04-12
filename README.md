# The Farm Gate

The Farm Gate is a farm-to-door delivery web application that connects local farm producers directly with customers. Customers can browse products across categories, filter by farm, add items to a basket, and place orders with a delivery address - with postcodes automatically matched to a local collection centre. Farm producers can register their own accounts and manage their full product catalogue through a dedicated dashboard, including adding, editing, and removing listings with prices, descriptions, and images. The platform supports three user roles - customer, farm, and admin - each with appropriate access controls throughout.

The backend is built with Node.js and Express, using MongoDB with Mongoose for data persistence and JWT for stateless authentication. Security is enforced through helmet (HTTP headers), express-rate-limit (brute force protection), express-mongo-sanitize (NoSQL injection prevention), express-validator (input validation and sanitisation), and server-side price verification on all orders. The Angular 17 frontend uses standalone components, computed signals for reactive state, Angular Material for UI, and an HTTP interceptor for attaching auth tokens. The backend is covered by 30 integration tests using Jest and Supertest against an in-memory MongoDB instance, with frontend unit tests written in Jasmine.

---

## Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | Angular 17, Angular Material      |
| Backend  | Node.js, Express 4                |
| Database | MongoDB via Mongoose              |
| Auth     | JWT (jsonwebtoken + bcryptjs)     |

---

## Prerequisites

- Node.js 18+
- MongoDB running locally (default: `mongodb://localhost:27017`) **or** a MongoDB Atlas URI

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd TheFarmGate
npm run install:all
```

### 2. Configure environment

```bash
cp .env.example server/.env
```

Edit `server/.env`:

```
MONGO_URI=mongodb://localhost:27017/thefarmgate
JWT_SECRET=change_me_to_something_random
PORT=3000
```

### 3. Seed the database

```bash
npm run seed
```

This inserts two collection centres, 21 products across 6 categories, and a demo admin account:

| Email                          | Password    | Role  |
|--------------------------------|-------------|-------|
| admin@thefarmgate.co.uk        | password123 | admin |

### 4. Run in development

Open two terminals:

```bash
# Terminal 1 — API server (http://localhost:3000)
npm run server

# Terminal 2 — Angular dev server (http://localhost:4200)
npm run client
```

Or run both concurrently from the root:

```bash
npm run dev
```

---

## API Reference

| Method | Endpoint                        | Auth     | Description                   |
|--------|---------------------------------|----------|-------------------------------|
| POST   | /api/users/register             | —        | Register + receive JWT        |
| POST   | /api/users/login                | —        | Login + receive JWT           |
| GET    | /api/users/me                   | Bearer   | Current user profile          |
| GET    | /api/products                   | —        | All products (opt ?category=) |
| GET    | /api/products/:id               | —        | Single product                |
| POST   | /api/products                   | Admin    | Create product                |
| GET    | /api/orders/my                  | Bearer   | Current user's orders         |
| POST   | /api/orders                     | Bearer   | Place order                   |
| GET    | /api/centres                    | —        | All collection centres        |
| GET    | /api/centres/lookup?postcode=   | —        | Find centre by postcode       |
