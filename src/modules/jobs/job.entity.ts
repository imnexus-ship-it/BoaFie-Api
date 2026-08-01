export type JobStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';

export interface JobRow {
  id: string;
  client_id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  skills_required: string[];
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  region: string | null;
  city: string | null;
  is_remote: boolean;
  budget_min_ghs: string | null;
  budget_max_ghs: string | null;
  budget_type: string;
  currency: string;
  deadline: string | null;
  urgency: string;
  status: JobStatus;
  hired_worker_id: string | null;
  media_urls: string[];
  is_diaspora_job: boolean;
  diaspora_country: string | null;
  view_count: number;
  proposal_count: number;
  ai_scam_score: string;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export function toJobDto(row: JobRow, client?: { id: string; full_name: string; avatar_url: string | null }) {
  return {
    id: row.id,
    client_id: row.client_id,
    title: row.title,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    skills_required: row.skills_required,
    location_text: row.location_text,
    is_remote: row.is_remote,
    budget_min_ghs: row.budget_min_ghs === null ? null : Number(row.budget_min_ghs),
    budget_max_ghs: row.budget_max_ghs === null ? null : Number(row.budget_max_ghs),
    budget_type: row.budget_type,
    currency: row.currency,
    deadline: row.deadline,
    urgency: row.urgency,
    status: row.status,
    is_diaspora_job: row.is_diaspora_job,
    diaspora_country: row.diaspora_country,
    view_count: row.view_count,
    proposal_count: row.proposal_count,
    created_at: row.created_at,
    client,
  };
}
