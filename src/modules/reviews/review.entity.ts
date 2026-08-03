export interface ReviewRow {
  id: string;
  contract_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified: boolean;
  is_public: boolean;
  created_at: string;
}

export interface ReviewerJoin {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function toReviewDto(row: ReviewRow & { reviewer?: ReviewerJoin }) {
  return {
    id: row.id,
    contract_id: row.contract_id,
    reviewer_id: row.reviewer_id,
    reviewee_id: row.reviewee_id,
    rating: row.rating,
    comment: row.comment,
    created_at: row.created_at,
    reviewer: row.reviewer,
  };
}
