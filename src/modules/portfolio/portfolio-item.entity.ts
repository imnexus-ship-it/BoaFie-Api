export interface PortfolioItemRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  media_urls: string[];
  before_urls: string[];
  after_urls: string[];
  category: string | null;
  job_id: string | null;
  is_featured: boolean;
  created_at: string;
}
