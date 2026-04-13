// Set required env vars before any test module loads
process.env.JWT_SECRET = 'test_jwt_secret_for_jest';
process.env.NODE_ENV = 'test';
// Use bcrypt cost 1 in tests — bcrypt at cost 12 is ~400ms/hash, which makes
// tests with multiple user registrations exceed Jest's 5 second default timeout
process.env.BCRYPT_ROUNDS = '1';
