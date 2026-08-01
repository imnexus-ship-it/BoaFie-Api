export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface ProposalRow {
  id: string;
  job_id: string;
  worker_id: string;
  cover_letter: string;
  proposed_rate: string;
  rate_type: string;
  estimated_days: number | null;
  status: ProposalStatus;
  is_ai_assisted: boolean;
  created_at: string;
  updated_at: string;
}

export function toProposalDto(
  row: ProposalRow,
  job?: unknown,
  worker?: unknown,
) {
  return {
    id: row.id,
    job_id: row.job_id,
    worker_id: row.worker_id,
    cover_letter: row.cover_letter,
    proposed_rate: Number(row.proposed_rate),
    rate_type: row.rate_type,
    estimated_days: row.estimated_days,
    status: row.status,
    created_at: row.created_at,
    job,
    worker,
  };
}
