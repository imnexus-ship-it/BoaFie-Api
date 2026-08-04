export type Availability = 'available' | 'busy' | 'unavailable';

export interface FreelancerProfileRow {
  id: string;
  user_id: string;
  title: string;
  skills: string[];
  hourly_rate_ghs: string | null;
  availability: Availability;
  remote_only: boolean;
  location_text: string | null;
  region: string | null;
  portfolio_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  ai_bio: string | null;
  total_jobs_done: number;
  profile_views: number;
  created_at: string;
  updated_at: string;
}

export interface JoinedUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  status: string;
}

export type FreelancerProfileWithUser = FreelancerProfileRow & {
  users?: JoinedUser;
  avg_rating?: string | null;
  review_count?: string | null;
  overall_verified?: boolean | null;
};

/**
 * Maps a DB row (NUMERIC columns come back from `pg` as strings) to the
 * shape boafie-web's FreelancerProfile type expects. portfolio/linkedin/
 * github links are fine to surface publicly — they're credential links
 * the freelancer chose to add, not the kind of off-platform contact info
 * (phone/email/WhatsApp) the messaging filter blocks.
 */
export function toFreelancerProfile(row: FreelancerProfileWithUser) {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    skills: row.skills,
    hourly_rate_ghs: row.hourly_rate_ghs !== null ? Number(row.hourly_rate_ghs) : null,
    pricing_model: row.hourly_rate_ghs !== null ? ('hourly' as const) : null,
    availability: row.availability,
    remote_only: row.remote_only,
    location_text: row.location_text,
    region: row.region,
    portfolio_url: row.portfolio_url,
    linkedin_url: row.linkedin_url,
    github_url: row.github_url,
    total_jobs_done: row.total_jobs_done,
    ai_bio: row.ai_bio,
    avg_rating: row.avg_rating ? Number(row.avg_rating) : null,
    review_count: row.review_count ? Number(row.review_count) : 0,
    verified: row.overall_verified ?? false,
    users: row.users,
  };
}
