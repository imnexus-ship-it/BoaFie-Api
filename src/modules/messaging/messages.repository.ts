import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { MessageRow, MessageWithSender } from './message.entity';

const SENDER_JOIN_SELECT = `
  m.*,
  json_build_object(
    'id', u.id,
    'full_name', u.full_name,
    'avatar_url', u.avatar_url
  ) AS sender
`;

@Injectable()
export class MessagesRepository extends BaseRepository<MessageRow> {
  constructor(db: DatabaseService) {
    super(db, 'messages');
  }

  async listForConversation(conversationId: string): Promise<MessageWithSender[]> {
    const { rows } = await this.db.query<MessageWithSender>(
      `SELECT ${SENDER_JOIN_SELECT}
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId],
    );
    return rows;
  }

  async findByIdWithSender(id: string): Promise<MessageWithSender | null> {
    const { rows } = await this.db.query<MessageWithSender>(
      `SELECT ${SENDER_JOIN_SELECT}
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }
}
