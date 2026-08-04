export type DisputeStatus = 'open' | 'under_review' | 'resolved_client' | 'resolved_worker' | 'escalated';

export interface DisputeRow {
  id: string;
  contract_id: string;
  raised_by: string;
  against_user: string;
  reason: string;
  description: string;
  evidence_urls: string[] | null;
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export function toDisputeDto(row: DisputeRow) {
  return {
    id: row.id,
    contract_id: row.contract_id,
    raised_by: row.raised_by,
    against_user: row.against_user,
    reason: row.reason,
    description: row.description,
    evidence_urls: row.evidence_urls,
    status: row.status,
    resolution_note: row.resolution_note,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
  };
}

/** Dispute states where the case is still open and no resolution has been reached. */
export const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = ['open', 'under_review', 'escalated'];
