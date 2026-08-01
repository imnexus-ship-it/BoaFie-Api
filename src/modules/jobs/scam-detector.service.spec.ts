import { ScamDetectorService } from './scam-detector.service';

describe('ScamDetectorService', () => {
  const service = new ScamDetectorService();

  const base = { title: 'Fix my sink', description: 'A normal plumbing job.', budgetMaxGhs: 500, clientPriorJobsCount: 3 };

  it('scores a clean, ordinary job at 0 with no flags', () => {
    const result = service.score(base);
    expect(result.score).toBe(0);
    expect(result.flags).toEqual([]);
  });

  it('flags advance-fee language', () => {
    const result = service.score({ ...base, description: 'Please send momo first before I share the address.' });
    expect(result.flags).toContain('advance_fee_language');
    expect(result.score).toBeCloseTo(0.4);
  });

  it('flags unrealistic budgets over 50,000 GHS', () => {
    const result = service.score({ ...base, budgetMaxGhs: 60000 });
    expect(result.flags).toContain('unrealistic_budget');
    expect(result.score).toBeCloseTo(0.15);
  });

  it('does not flag budgets at or under the 50,000 threshold', () => {
    const result = service.score({ ...base, budgetMaxGhs: 50000 });
    expect(result.flags).not.toContain('unrealistic_budget');
  });

  it('flags urgency manipulation only when 2+ urgency words appear', () => {
    const oneWord = service.score({ ...base, description: 'This is urgent, please respond.' });
    expect(oneWord.flags).not.toContain('urgency_manipulation');

    const twoWords = service.score({ ...base, description: 'Urgent! Need this done immediately.' });
    expect(twoWords.flags).toContain('urgency_manipulation');
  });

  it('flags a brand-new client posting a high-value job', () => {
    const result = service.score({ ...base, clientPriorJobsCount: 0, budgetMaxGhs: 5001 });
    expect(result.flags).toContain('new_client_high_value');
  });

  it('does not flag a new client posting a low-value job', () => {
    const result = service.score({ ...base, clientPriorJobsCount: 0, budgetMaxGhs: 5000 });
    expect(result.flags).not.toContain('new_client_high_value');
  });

  it('sums every rule when they all fire, and never exceeds 1.0', () => {
    const result = service.score({
      title: 'URGENT ASAP job today only',
      description: 'Send money first, pay before we start, urgent, immediately, limited time.',
      budgetMaxGhs: 100000,
      clientPriorJobsCount: 0,
    });
    // 0.4 (advance-fee) + 0.15 (budget) + 0.1 (urgency) + 0.2 (new client) = 0.85 —
    // the current rule weights can never actually sum past 1, so this also
    // documents that the Math.min(score, 1) cap is defensive, not reachable.
    expect(result.score).toBeCloseTo(0.85);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.flags.sort()).toEqual(
      ['advance_fee_language', 'new_client_high_value', 'unrealistic_budget', 'urgency_manipulation'].sort(),
    );
  });
});
