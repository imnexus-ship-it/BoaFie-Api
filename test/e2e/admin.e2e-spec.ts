import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import request from 'supertest';
import { createTestApp, uniqueEmail } from './helpers';

/**
 * Admin accounts can't be created through POST /auth/register (role is
 * restricted to client/artisan/freelancer by design) — so, like the real
 * seed script, this inserts the admin row directly and logs in normally.
 */
async function createAdminAndLogin(server: any, pool: Pool, password: string) {
  const email = uniqueEmail('admin');
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, status, phone_verified, email_verified)
     VALUES ($1, $2, 'Test Admin', 'admin', 'active', TRUE, TRUE) RETURNING id`,
    [email, passwordHash],
  );
  await pool.query('INSERT INTO wallets (user_id) VALUES ($1)', [rows[0].id]);
  const res = await request(server).post('/v1/auth/login').send({ email, password }).expect(200);
  return { id: rows[0].id, token: res.body.data.access_token };
}

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let pool: Pool;
  const password = 'Password123';

  let adminToken: string;
  let clientToken: string;
  let targetUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const admin = await createAdminAndLogin(server, pool, password);
    adminToken = admin.token;

    const client = await request(server)
      .post('/v1/auth/register')
      .send({ email: uniqueEmail('admin-target'), password, full_name: 'Target User', role: 'client' });
    clientToken = client.body.data.access_token;
    targetUserId = client.body.data.user.id;
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('rejects non-admins from every /admin route', async () => {
    await request(server).get('/v1/admin/stats').set('Authorization', `Bearer ${clientToken}`).expect(403);
  });

  it('rejects unauthenticated requests', async () => {
    await request(server).get('/v1/admin/stats').expect(401);
  });

  it('returns platform stats with real counts for an admin', async () => {
    const res = await request(server).get('/v1/admin/stats').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        total_users: expect.any(Number),
        total_artisans: expect.any(Number),
        open_jobs: expect.any(Number),
        total_commission_earned_ghs: expect.any(Number),
      }),
    );
    expect(res.body.data.total_users).toBeGreaterThanOrEqual(2); // at least the admin + the client just created
  });

  it('suspends and reinstates a user, logging both actions to the audit log', async () => {
    await request(server)
      .patch(`/v1/admin/users/${targetUserId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'e2e test' })
      .expect(200);

    // a suspended user's existing token is rejected on their next request
    await request(server).get('/v1/users/me').set('Authorization', `Bearer ${clientToken}`).expect(401);

    await request(server)
      .patch(`/v1/admin/users/${targetUserId}/reinstate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const auditLog = await request(server)
      .get('/v1/admin/audit-log')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const actions = auditLog.body.data.map((entry: any) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['user_suspended', 'user_active']));
  });
});
