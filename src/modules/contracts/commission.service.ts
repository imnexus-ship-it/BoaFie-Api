import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

const RATES: Record<string, number> = {
  free: 0.12,
  verified_pro: 0.08,
  business: 0.05,
};

export interface CommissionBreakdown {
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
}

/**
 * Matches boafie_monetization_strategy.md's CommissionService exactly:
 * 12% free / 8% Verified Pro / 5% Business, falling back to the free rate
 * if the worker's paid plan has expired.
 */
@Injectable()
export class CommissionService {
  constructor(private readonly db: DatabaseService) {}

  async calculate(workerId: string, grossAmount: number): Promise<CommissionBreakdown> {
    const { rows } = await this.db.query<{ plan: string; plan_expires_at: string | null }>(
      'SELECT plan, plan_expires_at FROM users WHERE id = $1',
      [workerId],
    );
    const user = rows[0];
    const planActive = !user?.plan_expires_at || new Date(user.plan_expires_at) > new Date();
    const effectivePlan = planActive ? (user?.plan ?? 'free') : 'free';
    const commissionRate = RATES[effectivePlan] ?? RATES.free;
    const commissionAmount = Math.round(grossAmount * commissionRate * 100) / 100;
    const netAmount = Math.round((grossAmount - commissionAmount) * 100) / 100;
    return { commissionRate, commissionAmount, netAmount };
  }
}
