import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { ConversationsRepository } from './conversations.repository';
import { MessagesRepository } from './messages.repository';

@Module({
  controllers: [MessagingController],
  providers: [MessagingService, ConversationsRepository, MessagesRepository],
  exports: [MessagingService],
})
export class MessagingModule {}
