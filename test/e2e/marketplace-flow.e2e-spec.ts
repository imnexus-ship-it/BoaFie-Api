import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueEmail } from './helpers';

/**
 * The full golden path: post a job, propose, accept (auto-creates contract
 * + escrow + a conversation), add a milestone, start/submit/approve it, and
 * check the money lands correctly net of commission. This mirrors the
 * manual browser walkthrough done during development — same flow, now
 * repeatable and asserting exact numbers instead of eyeballing screenshots.
 */
describe('Marketplace golden path (e2e)', () => {
  let app: INestApplication;
  let server: any;
  const password = 'Password123';

  let clientToken: string;
  let artisanToken: string;
  let jobId: string;
  let proposalId: string;
  let contractId: string;
  let milestoneId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const client = await request(server)
      .post('/v1/auth/register')
      .send({ email: uniqueEmail('flow-client'), password, full_name: 'Flow Client', role: 'client' });
    clientToken = client.body.data.access_token;

    const artisan = await request(server)
      .post('/v1/auth/register')
      .send({ email: uniqueEmail('flow-artisan'), password, full_name: 'Flow Artisan', role: 'artisan' });
    artisanToken = artisan.body.data.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('client posts a job', async () => {
    const res = await request(server)
      .post('/v1/jobs')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Fix leaking kitchen sink',
        description: 'The kitchen sink has been leaking for a week.',
        category: 'plumbing',
        budget_min_ghs: 150,
        budget_max_ghs: 250,
      })
      .expect(201);

    expect(res.body.data.status).toBe('open');
    expect(res.body.data.budget_min_ghs).toBe(150); // numeric, not a "150.00" string
    jobId = res.body.data.id;
  });

  it('the job appears in the public listing', async () => {
    const res = await request(server).get('/v1/jobs').expect(200);
    expect(res.body.data.some((j: any) => j.id === jobId)).toBe(true);
    expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, limit: 20 }));
  });

  it('artisan submits a proposal', async () => {
    const res = await request(server)
      .post(`/v1/jobs/${jobId}/proposals`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ cover_letter: 'I can fix this same day, 6 years experience.', proposed_rate: 200 })
      .expect(201);

    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.proposed_rate).toBe(200);
    proposalId = res.body.data.id;
  });

  it('rejects a second proposal from the same worker on the same job', async () => {
    await request(server)
      .post(`/v1/jobs/${jobId}/proposals`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ cover_letter: 'Trying again', proposed_rate: 180 })
      .expect(409);
  });

  it("GET /jobs/recommended doesn't 500 (regression: ambiguous 'status' column)", async () => {
    await request(server).get('/v1/jobs/recommended').set('Authorization', `Bearer ${artisanToken}`).expect(200);
  });

  it('client accepts the proposal, auto-creating a contract with a funded escrow', async () => {
    const res = await request(server)
      .patch(`/v1/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(res.body.data.contract.status).toBe('in_progress');
    expect(res.body.data.contract.agreed_amount).toBe(200);
    contractId = res.body.data.contract.id;

    const detail = await request(server)
      .get(`/v1/contracts/${contractId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(detail.body.data.escrow).toEqual(
      expect.objectContaining({ total_amount: 200, held_amount: 200, released_amount: 0, status: 'held' }),
    );
  });

  it('the job is no longer open once a proposal is accepted', async () => {
    const res = await request(server).get('/v1/jobs').expect(200);
    expect(res.body.data.some((j: any) => j.id === jobId)).toBe(false);
  });

  it('a conversation was auto-created between client and worker', async () => {
    const res = await request(server)
      .get('/v1/conversations')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(res.body.data.some((c: any) => c.contract_id === contractId)).toBe(true);
  });

  it('client adds a milestone', async () => {
    const res = await request(server)
      .post(`/v1/contracts/${contractId}/milestones`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Replace pipe and fix leak', amount_ghs: 200 })
      .expect(201);
    expect(res.body.data.status).toBe('pending');
    milestoneId = res.body.data.id;
  });

  it('ownership and state are both enforced on milestone actions', async () => {
    // wrong user entirely (ownership checked before state)
    await request(server)
      .patch(`/v1/milestones/${milestoneId}/approve`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(403);

    // right user (the client), but the milestone is still 'pending', not 'submitted'
    await request(server)
      .patch(`/v1/milestones/${milestoneId}/approve`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(400);

    // client is not the worker, so can't start a milestone at all
    await request(server)
      .patch(`/v1/milestones/${milestoneId}/start`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('artisan starts and submits the milestone', async () => {
    await request(server)
      .patch(`/v1/milestones/${milestoneId}/start`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(200);

    const res = await request(server)
      .patch(`/v1/milestones/${milestoneId}/submit`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .send({ submission_note: 'Replaced the pipe and sealed the leak.' })
      .expect(200);
    expect(res.body.data.status).toBe('submitted');
  });

  it('client approves the milestone — escrow releases, commission deducted, wallet credited', async () => {
    const res = await request(server)
      .patch(`/v1/milestones/${milestoneId}/approve`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(res.body.data.status).toBe('approved');

    const contractDetail = await request(server)
      .get(`/v1/contracts/${contractId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(contractDetail.body.data.escrow).toEqual(
      expect.objectContaining({ held_amount: 0, released_amount: 200, status: 'released' }),
    );

    const wallet = await request(server)
      .get('/v1/wallet')
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(200);
    // 200 gross, free-plan 12% commission -> 24 commission, 176 net
    expect(wallet.body.data.balance_ghs).toBe(176);
    expect(wallet.body.data.lifetime_earned).toBe(176);

    const txns = await request(server)
      .get('/v1/wallet/transactions')
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(200);
    expect(txns.body.data[0]).toEqual(
      expect.objectContaining({
        type: 'escrow_release',
        status: 'completed',
        amount: 200, // gross milestone amount
        commission_rate: 0.12,
        commission_amount: 24,
        net_amount: 176, // what the frontend should actually display as the credited amount
      }),
    );
  });

  it('real notifications were created along the way, and the unread count is accurate', async () => {
    // artisan: notified on "proposal accepted" and "milestone approved"
    const artisanDashboard = await request(server)
      .get('/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(200);
    expect(artisanDashboard.body.data.unread_notifications).toBe(2);

    const artisanNotifications = await request(server)
      .get('/v1/users/me/notifications')
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(200);
    const titles = artisanNotifications.body.data.map((n: any) => n.title);
    expect(titles).toEqual(expect.arrayContaining(['Proposal accepted', 'Milestone approved — funds released']));
    expect(artisanNotifications.body.data.every((n: any) => n.is_read === false)).toBe(true);

    // client: notified on "new proposal received" (initial submission) and
    // "milestone submitted for review"
    const clientDashboard = await request(server)
      .get('/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(clientDashboard.body.data.unread_notifications).toBe(2);

    // marking one read drops the count by exactly one
    const notificationId = artisanNotifications.body.data[0].id;
    await request(server)
      .patch(`/v1/users/me/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(200);
    const afterOneRead = await request(server)
      .get('/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(200);
    expect(afterOneRead.body.data.unread_notifications).toBe(1);

    // mark-all-read zeroes it out
    await request(server)
      .patch('/v1/users/me/notifications/read-all')
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(200);
    const afterAllRead = await request(server)
      .get('/v1/users/me/dashboard')
      .set('Authorization', `Bearer ${artisanToken}`)
      .expect(200);
    expect(afterAllRead.body.data.unread_notifications).toBe(0);
  });

  it('the milestone cannot be approved twice', async () => {
    await request(server)
      .patch(`/v1/milestones/${milestoneId}/approve`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(400);
  });
});
