import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueEmail } from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  const password = 'Password123';

  it('registers a new user and returns user + access_token + refresh_token', async () => {
    const email = uniqueEmail('register');
    const res = await request(server)
      .post('/v1/auth/register')
      .send({ email, password, full_name: 'Test Client', role: 'client' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email, full_name: 'Test Client', role: 'client' });
    expect(typeof res.body.data.access_token).toBe('string');
    expect(typeof res.body.data.refresh_token).toBe('string');
  });

  it('rejects a weak password', async () => {
    const res = await request(server)
      .post('/v1/auth/register')
      .send({ email: uniqueEmail('weak'), password: 'weak', full_name: 'Weak Pw', role: 'client' })
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects registering an admin role from the public endpoint', async () => {
    await request(server)
      .post('/v1/auth/register')
      .send({ email: uniqueEmail('sneaky'), password, full_name: 'Sneaky', role: 'admin' })
      .expect(400);
  });

  it('rejects duplicate email registration', async () => {
    const email = uniqueEmail('dup');
    await request(server)
      .post('/v1/auth/register')
      .send({ email, password, full_name: 'First', role: 'client' })
      .expect(201);
    const res = await request(server)
      .post('/v1/auth/register')
      .send({ email, password, full_name: 'Second', role: 'client' })
      .expect(409);
    expect(res.body.success).toBe(false);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const email = uniqueEmail('login');
    await request(server).post('/v1/auth/register').send({ email, password, full_name: 'Login Test', role: 'client' });

    await request(server).post('/v1/auth/login').send({ email, password }).expect(200);
    await request(server).post('/v1/auth/login').send({ email, password: 'WrongPass1' }).expect(401);
    await request(server).post('/v1/auth/login').send({ email: uniqueEmail('nobody'), password }).expect(401);
  });

  it('rejects requests to protected routes with no token, and accepts a valid one', async () => {
    await request(server).get('/v1/users/me').expect(401);

    const email = uniqueEmail('protected');
    const { body } = await request(server)
      .post('/v1/auth/register')
      .send({ email, password, full_name: 'Protected Test', role: 'client' });

    const res = await request(server)
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${body.data.access_token}`)
      .expect(200);
    expect(res.body.data.email).toBe(email);
  });

  it('refreshes tokens, and detects reuse of an already-consumed refresh token', async () => {
    const email = uniqueEmail('refresh');
    const { body: registerBody } = await request(server)
      .post('/v1/auth/register')
      .send({ email, password, full_name: 'Refresh Test', role: 'client' });
    const firstRefreshToken = registerBody.data.refresh_token;

    const refreshRes = await request(server)
      .post('/v1/auth/refresh')
      .send({ refresh_token: firstRefreshToken })
      .expect(200);
    const secondRefreshToken = refreshRes.body.data.refresh_token;
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    // second refresh with the new token works
    await request(server).post('/v1/auth/refresh').send({ refresh_token: secondRefreshToken }).expect(200);

    // reusing the very first (already-consumed) token is rejected...
    const reuseRes = await request(server)
      .post('/v1/auth/refresh')
      .send({ refresh_token: firstRefreshToken })
      .expect(401);
    expect(reuseRes.body.error.message).toMatch(/reuse detected/i);

    // ...and wipes every session for that user, including the one issued by the second refresh
    await request(server).post('/v1/auth/refresh').send({ refresh_token: secondRefreshToken }).expect(401);
  });
});
