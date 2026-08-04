import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AiService } from './ai.service';
import { GenerateBioDto } from './dto/generate-bio.dto';
import { GenerateProposalDraftDto } from './dto/generate-proposal-draft.dto';
import { SupportChatDto } from './dto/support-chat.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('bio')
  async generateBio(@Body() dto: GenerateBioDto) {
    const bio = await this.aiService.generateBio(dto);
    return { bio };
  }

  @Post('proposal-draft')
  async draftProposal(@CurrentUser() user: RequestUser, @Body() dto: GenerateProposalDraftDto) {
    const cover_letter = await this.aiService.draftProposalForJob(user.id, user.role, dto.job_id);
    return { cover_letter };
  }

  @Public()
  @Post('support-chat')
  async supportChat(@Body() dto: SupportChatDto) {
    const reply = await this.aiService.supportChat(dto.messages);
    return { reply };
  }
}
