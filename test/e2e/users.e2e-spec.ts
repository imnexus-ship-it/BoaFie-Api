import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueEmail } from './helpers';

describe('Account deletion (e2e)', () => {
  let app: INestApplication;
  let server: any;
  const password = 'Password123';

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deletes an account with no active contracts: scrubs PII and blocks future login', async () => {
    const email = uniqueEmail('delete-me');
    const register = await request(server)
      .post('/v1/auth/register')
      .send({ email, password, full_name: 'Soon Gone', role: 'client' });
    const token = register.body.data.access_token;
    const userId = register.body.data.user.id;

    await request(server).delete('/v1/users/me').set('Authorization', `Bearer ${token}`).expect(200);

    // the access token issued before deletion is rejected on the very next request
    await request(server).get('/v1/users/me').set('Authorization', `Bearer ${token}`).expect(401);

    // can't log back in with the old credentials
    await request(server).post('/v1/auth/login').send({ email, password }).expect(401);

    // the public profile no longer shows real PII
    const publicProfile = await request(server).get(`/v1/users/${userId}/public`).expect(200);
    expect(publicProfile.body.data.full_name).toBe('Deleted user');
  });

  it('blocks deletion while a contract is in progress', async () => {
    const client = await request(server)
      .post('/v1/auth/register')
      .send({ email: uniqueEmail('del-client'), password, full_name: 'Del Client', role: 'client' });
    const clientToken = client.body.data.access_token;

    const artisan = await request(server)
      .post('/v1/auth/register')
      .send({ email: uniqueEmail('del-artisan'), password, full_name: 'Del Artisan', role: 'artisan' });
    const artisanToken = artisan.body.data.access_token;

    const job = await request(server)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Paint a fence',
        description: 'Needs a fresh coat of paint.',
        category: 'painting',
        budget_min_ghs: 100,
        budget_max_ghs: 150,
      });
    const jobId = job.body.data.id;

    const proposal = await request(server)
      .post(`/v1/jobs/${jobId}/proposals`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ cover_letter: 'Can start today.', proposed_rate: 120 });

    await request(server)
      .patch(`/v1/proposals/${proposal.body.data.id}/accept`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const res = await request(server)
      .delete('/v1/users/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(409);
    expect(res.body.error.message).toMatch(/contract is in progress/i);

    // the worker side of the same contract is blocked too
    await request(server).delete('/v1/users/me').set('Authorization', `Bearer ${artisanToken}`).expect(409);
  });
});
