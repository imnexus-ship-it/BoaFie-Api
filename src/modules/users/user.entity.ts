export type UserRole = 'client' | 'artisan' | 'freelancer' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'banned' | 'pending_review';
export type PlanType = 'free' | 'verified_pro' | 'business';

export interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string | null;
  google_id: string | null;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  bio: string | null;
  status: AccountStatus;
  plan: PlanType;
  plan_expires_at: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  diaspora_mode: boolean;
  country_of_residence: string | null;
  preferred_currency: string;
  preferred_language: string;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export function toPublicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    avatar_url: user.avatar_url,
    bio: user.bio,
    phone: user.phone,
    status: user.status,
    plan: user.plan,
    diaspora_mode: user.diaspora_mode,
    country_of_residence: user.country_of_residence,
    preferred_currency: user.preferred_currency,
    created_at: user.created_at,
  };
}

/** Subset persisted to the frontend's auth-store. */
export function toAuthUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    avatar_url: user.avatar_url,
  };
}
