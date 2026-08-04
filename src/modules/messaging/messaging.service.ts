import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ConversationsRepository } from './conversations.repository';
import { MessagesRepository } from './messages.repository';
import { MessageFilterService } from './message-filter.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

const CONTACT_INFO_BLOCK_MESSAGE =
  "For your protection, messages can't include phone numbers, emails, or mentions of other messaging apps. " +
  'Keep all communication on BoaFie so your contract, payments, and reviews stay covered.';

/** Message types requiring non-empty text content. */
const TEXT_REQUIRED_TYPES = ['text', 'quotation'];
/** Message types requiring at least one attachment URL. */
const ATTACHMENT_REQUIRED_TYPES = ['image', 'file', 'voice_note', 'video'];

@Injectable()
export class MessagingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly conversations: ConversationsRepository,
    private readonly messages: MessagesRepository,
    private readonly notifications: NotificationsService,
    private readonly filter: MessageFilterService,
  ) {}

  /**
   * Enriches each conversation with the other participant's name/avatar
   * and a preview of the most recent message — the dashboard "Messages"
   * panel needs both and the bare conversation row has neither. Two
   * extra queries per conversation, but conversation counts per user are
   * small (dozens at most), so this stays simple rather than adding a
   * materialized "last message" column to maintain.
   */
  async listConversations(userId: string) {
    const rows = await this.conversations.listForUser(userId);
    return Promise.all(
      rows.map(async (c) => {
        const otherId = c.participant_ids.find((id) => id !== userId);
        const [otherUserResult, lastMessageResult] = await Promise.all([
          otherId
            ? this.db.query<{ id: string; full_name: string; avatar_url: string | null }>(
                'SELECT id, full_name, avatar_url FROM users WHERE id = $1',
                [otherId],
              )
            : null,
          this.db.query<{ content: string | null; type: string; created_at: string }>(
            'SELECT content, type, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
            [c.id],
          ),
        ]);
        return {
          ...c,
          other_participant: otherUserResult?.rows[0] ?? null,
          last_message: lastMessageResult.rows[0] ?? null,
        };
      }),
    );
  }

  async getConversation(id: string, userId: string) {
    const conversation = await this.conversations.findById(id);
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.participant_ids.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
    const messages = await this.messages.listForConversation(id);
    return { ...conversation, messages };
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    const participantIds = dto.participant_ids.includes(userId)
      ? dto.participant_ids
      : [...dto.participant_ids, userId];
    return this.conversations.insert({
      participant_ids: participantIds,
      job_id: dto.job_id ?? null,
      contract_id: dto.contract_id ?? null,
    });
  }

  async sendMessage(conversationId: string, userId: string, dto: SendMessageDto) {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.participant_ids.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    if (TEXT_REQUIRED_TYPES.includes(dto.type) && !dto.content?.trim()) {
      throw new BadRequestException('Message content is required');
    }
    if (ATTACHMENT_REQUIRED_TYPES.includes(dto.type) && !(dto.media_urls && dto.media_urls.length > 0)) {
      throw new BadRequestException('At least one attachment is required for this message type');
    }
    if (dto.type === 'quotation' && (typeof dto.metadata?.amount_ghs !== 'number' || dto.metadata.amount_ghs <= 0)) {
      throw new BadRequestException('A quotation must include a positive amount_ghs in metadata');
    }

    if (dto.content) {
      const scan = this.filter.scanForExternalContact(dto.content);
      if (scan.blocked) throw new BadRequestException(CONTACT_INFO_BLOCK_MESSAGE);
    }

    const message = await this.messages.insert({
      conversation_id: conversationId,
      sender_id: userId,
      type: dto.type,
      content: dto.content ?? null,
      media_urls: dto.media_urls ?? [],
      metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
    });
    await this.conversations.updateLastMessageAt(conversationId);

    const withSender = await this.messages.findByIdWithSender(message.id);

    const recipientIds = conversation.participant_ids.filter((id) => id !== userId);
    const notifyBody =
      dto.type === 'text'
        ? dto.content
        : dto.type === 'quotation'
          ? `Sent a quotation: GHS ${dto.metadata?.amount_ghs}`
          : `Sent a ${dto.type.replace('_', ' ')}`;
    for (const recipientId of recipientIds) {
      await this.notifications.notify(
        recipientId,
        'message',
        `New message from ${withSender!.sender!.full_name}`,
        notifyBody,
        { conversation_id: conversationId },
      );
    }

    return withSender!;
  }

  /**
   * Internal only — not exposed via any user-postable DTO. Used to auto-
   * narrate lifecycle events (milestone submitted/approved/etc) directly
   * into the contract's conversation, attributed to whichever party
   * actually triggered the event.
   */
  async postSystemMessage(
    conversationId: string,
    senderId: string,
    type: 'system' | 'milestone_update',
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    const message = await this.messages.insert({
      conversation_id: conversationId,
      sender_id: senderId,
      type,
      content,
      media_urls: [],
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
    await this.conversations.updateLastMessageAt(conversationId);
    return message;
  }

  /** Used by MilestonesService to narrate milestone events without needing its own conversation lookup. */
  async postSystemMessageForContract(
    contractId: string,
    senderId: string,
    type: 'system' | 'milestone_update',
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    const conversation = await this.conversations.findOne({ contract_id: contractId });
    if (!conversation) return null;
    return this.postSystemMessage(conversation.id, senderId, type, content, metadata);
  }

  /** Callable by other modules once a client/worker contract is created. */
  async createForContract(
    clientId: string,
    workerId: string,
    jobId: string,
    contractId: string,
  ): Promise<{ id: string }> {
    const conversation = await this.conversations.insert({
      participant_ids: [clientId, workerId],
      job_id: jobId,
      contract_id: contractId,
    });
    await this.postSystemMessage(
      conversation.id,
      clientId,
      'system',
      'Contract created. You can now message each other directly.',
      { contract_id: contractId },
    );
    return { id: conversation.id };
  }
}
