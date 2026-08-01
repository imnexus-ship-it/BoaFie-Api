export interface ConversationRow {
  id: string;
  job_id: string | null;
  contract_id: string | null;
  participant_ids: string[];
  last_message_at: string | null;
  created_at: string;
}
