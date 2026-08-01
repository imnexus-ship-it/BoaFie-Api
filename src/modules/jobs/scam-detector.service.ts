import { Injectable } from '@nestjs/common';

const ADVANCE_FEE_PHRASES = [
  'send money first',
  'transfer first',
  'pay registration',
  'upfront fee',
  'materials money',
  'send momo first',
  'pay before',
  'advance payment required',
];

const URGENCY_WORDS = ['urgent', 'asap', 'immediately', 'today only', 'limited time'];

export interface ScamScoreResult {
  score: number;
  flags: string[];
}

/**
 * Pure rule-based scoring per the security doc — no external API call
 * needed, this is deliberately simple additive logic. The doc's full
 * version also blends in an AI semantic score from gpt-4o-mini when the
 * rule score lands in a borderline band (0.2–0.75); that blending step is
 * skipped here since it needs an OpenAI key this build doesn't wire up —
 * flagged in the module README as a follow-up, not silently dropped.
 */
@Injectable()
export class ScamDetectorService {
  score(input: {
    title: string;
    description: string;
    budgetMaxGhs: number | null;
    clientPriorJobsCount: number;
  }): ScamScoreResult {
    const text = `${input.title} ${input.description}`.toLowerCase();
    const flags: string[] = [];
    let score = 0;

    if (ADVANCE_FEE_PHRASES.some((phrase) => text.includes(phrase))) {
      score += 0.4;
      flags.push('advance_fee_language');
    }

    if (input.budgetMaxGhs !== null && input.budgetMaxGhs > 50000) {
      score += 0.15;
      flags.push('unrealistic_budget');
    }

    const urgencyMatches = URGENCY_WORDS.filter((word) => text.includes(word)).length;
    if (urgencyMatches >= 2) {
      score += 0.1;
      flags.push('urgency_manipulation');
    }

    if (
      input.clientPriorJobsCount === 0 &&
      input.budgetMaxGhs !== null &&
      input.budgetMaxGhs > 5000
    ) {
      score += 0.2;
      flags.push('new_client_high_value');
    }

    return { score: Math.min(score, 1), flags };
  }
}
