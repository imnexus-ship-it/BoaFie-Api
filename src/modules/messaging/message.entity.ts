export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  content: string | null;
  media_urls: string[];
  is_read: boolean;
  read_at: string | null;
  is_deleted: boolean;
  metadata: unknown;
  created_at: string;
}

export interface JoinedSender {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export type MessageWithSender = MessageRow & { sender?: JoinedSender };
