export type NotificationType =
  | 'job_match'
  | 'proposal'
  | 'message'
  | 'payment'
  | 'milestone'
  | 'review'
  | 'verification'
  | 'system';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
