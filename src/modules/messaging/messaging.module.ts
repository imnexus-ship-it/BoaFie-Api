import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { ConversationsRepository } from './conversations.repository';
import { MessagesRepository } from './messages.repository';

@Module({
  imports: [NotificationsModule],
  controllers: [MessagingController],
  providers: [MessagingService, ConversationsRepository, MessagesRepository],
  exports: [MessagingService],
})
export class MessagingModule {}
