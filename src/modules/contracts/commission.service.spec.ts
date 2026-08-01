import { CommissionService } from './commission.service';
import { DatabaseService } from '../../database/database.service';

function mockDb(userRow: { plan: string; plan_expires_at: string | null } | undefined) {
  return { query: jest.fn().mockResolvedValue({ rows: userRow ? [userRow] : [] }) } as unknown as DatabaseService;
}

describe('CommissionService', () => {
  it('applies the free-plan rate (12%) by default', async () => {
    const service = new CommissionService(mockDb({ plan: 'free', plan_expires_at: null }));
    const result = await service.calculate('worker-1', 1000);
    expect(result.commissionRate).toBe(0.12);
    expect(result.commissionAmount).toBe(120);
    expect(result.netAmount).toBe(880);
  });

  it('applies the Verified Pro rate (8%) when the plan is active', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const service = new CommissionService(mockDb({ plan: 'verified_pro', plan_expires_at: future }));
    const result = await service.calculate('worker-1', 1000);
    expect(result.commissionRate).toBe(0.08);
    expect(result.commissionAmount).toBe(80);
    expect(result.netAmount).toBe(920);
  });

  it('applies the Business rate (5%) when the plan is active', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const service = new CommissionService(mockDb({ plan: 'business', plan_expires_at: future }));
    const result = await service.calculate('worker-1', 1000);
    expect(result.commissionRate).toBe(0.05);
    expect(result.commissionAmount).toBe(50);
    expect(result.netAmount).toBe(950);
  });

  it('falls back to the free rate once a paid plan has expired', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    const service = new CommissionService(mockDb({ plan: 'business', plan_expires_at: past }));
    const result = await service.calculate('worker-1', 1000);
    expect(result.commissionRate).toBe(0.12);
  });

  it('a plan with no expiry date is treated as permanently active', async () => {
    const service = new CommissionService(mockDb({ plan: 'verified_pro', plan_expires_at: null }));
    const result = await service.calculate('worker-1', 1000);
    expect(result.commissionRate).toBe(0.08);
  });

  it('rounds to 2 decimal places', async () => {
    const service = new CommissionService(mockDb({ plan: 'free', plan_expires_at: null }));
    const result = await service.calculate('worker-1', 299.99);
    // 299.99 * 0.12 = 35.9988 -> rounds to 36.00; net = 263.99
    expect(result.commissionAmount).toBe(36);
    expect(result.netAmount).toBe(263.99);
  });

  it('defaults to the free rate if the worker row is missing', async () => {
    const service = new CommissionService(mockDb(undefined));
    const result = await service.calculate('ghost-worker', 1000);
    expect(result.commissionRate).toBe(0.12);
  });
});
