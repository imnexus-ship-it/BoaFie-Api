export interface BusinessProfileRow {
  id: string;
  user_id: string;
  legal_business_name: string;
  trading_name: string | null;
  business_type: string | null;
  registration_number: string | null;
  tax_id: string | null;
  industry: string | null;
  business_email: string | null;
  business_phone: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

export function toBusinessProfile(row: BusinessProfileRow) {
  return {
    id: row.id,
    user_id: row.user_id,
    legal_business_name: row.legal_business_name,
    trading_name: row.trading_name,
    business_type: row.business_type,
    registration_number: row.registration_number,
    tax_id: row.tax_id,
    industry: row.industry,
    business_email: row.business_email,
    business_phone: row.business_phone,
    region: row.region,
    city: row.city,
    created_at: row.created_at,
  };
}
