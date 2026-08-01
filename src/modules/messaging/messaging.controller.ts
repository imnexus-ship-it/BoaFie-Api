import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { MessagingService } from './messaging.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversations')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.messagingService.listConversations(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.messagingService.getConversation(id, user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateConversationDto) {
    return this.messagingService.createConversation(user.id, dto);
  }

  @Post(':conversationId/messages')
  sendMessage(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(conversationId, user.id, dto);
  }
}
