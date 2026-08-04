import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationsRepository } from './conversations.repository';
import { MessagesRepository } from './messages.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagingService {
  constructor(
    private readonly conversations: ConversationsRepository,
    private readonly messages: MessagesRepository,
    private readonly notifications: NotificationsService,
  ) {}

  listConversations(userId: string) {
    return this.conversations.listForUser(userId);
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

    const message = await this.messages.insert({
      conversation_id: conversationId,
      sender_id: userId,
      type: dto.type,
      content: dto.content,
    });
    await this.conversations.updateLastMessageAt(conversationId);

    const withSender = await this.messages.findByIdWithSender(message.id);

    const recipientIds = conversation.participant_ids.filter((id) => id !== userId);
    for (const recipientId of recipientIds) {
      await this.notifications.notify(
        recipientId,
        'message',
        `New message from ${withSender!.sender!.full_name}`,
        dto.type === 'text' ? dto.content : undefined,
        { conversation_id: conversationId },
      );
    }

    return withSender!;
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
    return { id: conversation.id };
  }
}
