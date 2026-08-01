export type Availability = 'available' | 'busy' | 'unavailable';

export interface ArtisanProfileRow {
  id: string;
  user_id: string;
  trade_category: string;
  trade_subcategories: string[];
  years_experience: number | null;
  hourly_rate_ghs: string | null;
  daily_rate_ghs: string | null;
  fixed_rate_min_ghs: string | null;
  availability: Availability;
  service_radius_km: number;
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  region: string | null;
  city: string | null;
  tools_owned: string[];
  languages: string[];
  whatsapp_number: string | null;
  emergency_hire: boolean;
  profile_views: number;
  total_jobs_done: number;
  ai_bio: string | null;
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

export type ArtisanProfileWithUser = ArtisanProfileRow & { users?: JoinedUser };

/**
 * Maps a DB row (NUMERIC columns come back from `pg` as strings) to the
 * shape boafie-web's ArtisanProfile type expects.
 */
export function toArtisanProfile(row: ArtisanProfileWithUser) {
  return {
    id: row.id,
    user_id: row.user_id,
    trade_category: row.trade_category,
    trade_subcategories: row.trade_subcategories,
    years_experience: row.years_experience,
    hourly_rate_ghs: row.hourly_rate_ghs !== null ? Number(row.hourly_rate_ghs) : null,
    daily_rate_ghs: row.daily_rate_ghs !== null ? Number(row.daily_rate_ghs) : null,
    availability: row.availability,
    location_text: row.location_text,
    region: row.region,
    city: row.city,
    total_jobs_done: row.total_jobs_done,
    ai_bio: row.ai_bio,
    users: row.users,
  };
}
