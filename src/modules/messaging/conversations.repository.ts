import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { ConversationRow } from './conversation.entity';

@Injectable()
export class ConversationsRepository extends BaseRepository<ConversationRow> {
  constructor(db: DatabaseService) {
    super(db, 'conversations');
  }

  async listForUser(userId: string): Promise<ConversationRow[]> {
    const { rows } = await this.db.query<ConversationRow>(
      `SELECT * FROM conversations WHERE $1 = ANY(participant_ids) ORDER BY last_message_at DESC NULLS LAST`,
      [userId],
    );
    return rows;
  }

  async updateLastMessageAt(id: string): Promise<void> {
    await this.db.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [id]);
  }
}
