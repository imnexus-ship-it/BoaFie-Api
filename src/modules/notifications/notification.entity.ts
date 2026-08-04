export type NotificationType =
  | 'job_match'
  | 'proposal'
  | 'message'
  | 'payment'
  | 'milestone'
  | 'review'
  | 'review_reminder'
  | 'verification'
  | 'security'
  | 'system';

/** Types a user can individually toggle in their notification preferences. `job_match` and `system` are not user-toggleable (job_match is unused today; system is reserved for platform-wide announcements). */
export const TOGGLEABLE_NOTIFICATION_TYPES = [
  'proposal',
  'message',
  'milestone',
  'payment',
  'verification',
  'review',
  'review_reminder',
  'security',
] as const satisfies readonly NotificationType[];

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
