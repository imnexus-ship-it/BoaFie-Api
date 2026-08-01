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

export type FreelancerProfileWithUser = FreelancerProfileRow & { users?: JoinedUser };

/**
 * Maps a DB row (NUMERIC columns come back from `pg` as strings) to the
 * shape boafie-web's FreelancerProfile type expects.
 */
export function toFreelancerProfile(row: FreelancerProfileWithUser) {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    skills: row.skills,
    hourly_rate_ghs: row.hourly_rate_ghs !== null ? Number(row.hourly_rate_ghs) : null,
    availability: row.availability,
    remote_only: row.remote_only,
    location_text: row.location_text,
    total_jobs_done: row.total_jobs_done,
    ai_bio: row.ai_bio,
    users: row.users,
  };
}
