/**
 * Shared heuristic for ranking job<->worker fit, used in both directions
 * ("jobs matched to a worker" and "workers matched to a job"). Deliberately
 * simple weighted scoring, not ML — cheap enough to run over the whole
 * open-jobs/profile pool per request at this marketplace's scale, with no
 * per-candidate external calls.
 */
export interface MatchScoreInput {
  categoryExactMatch: boolean;
  skillOverlapCount: number;
  locationMatch: boolean;
  rateFit: 'good' | 'neutral' | 'none';
  urgentJob: boolean;
  workerAvailable: boolean;
  trackRecord: number;
}

export function scoreMatch(input: MatchScoreInput): number {
  let score = input.categoryExactMatch ? 40 : Math.min(input.skillOverlapCount, 3) * 10;
  if (input.locationMatch) score += 20;
  if (input.rateFit === 'good') score += 20;
  else if (input.rateFit === 'neutral') score += 10;
  if (input.urgentJob) score += 5;
  if (input.workerAvailable) score += 5;
  score += Math.min(input.trackRecord, 10);
  return score;
}

export function overlapCount(a: string[] | null | undefined, b: string[] | null | undefined): number {
  if (!a?.length || !b?.length) return 0;
  const setB = new Set(b.map((s) => s.toLowerCase()));
  return a.filter((s) => setB.has(s.toLowerCase())).length;
}
