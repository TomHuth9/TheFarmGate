// Set required env vars before any test module loads
process.env.JWT_SECRET = 'test_jwt_secret_for_jest';
process.env.NODE_ENV = 'test';
