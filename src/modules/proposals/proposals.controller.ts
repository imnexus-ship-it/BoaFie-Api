import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';

@Controller()
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get('proposals/mine')
  listMine(@CurrentUser() user: RequestUser) {
    return this.proposalsService.listMine(user.id);
  }

  @Get('jobs/:jobId/proposals')
  listForJob(@CurrentUser() user: RequestUser, @Param('jobId') jobId: string) {
    return this.proposalsService.listForJob(jobId, user.id);
  }

  @Post('jobs/:jobId/proposals')
  create(
    @CurrentUser() user: RequestUser,
    @Param('jobId') jobId: string,
    @Body() dto: CreateProposalDto,
  ) {
    return this.proposalsService.create(jobId, user.id, dto);
  }

  @Patch('proposals/:id/accept')
  accept(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.proposalsService.accept(id, user.id);
  }

  @Patch('proposals/:id/reject')
  reject(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.proposalsService.reject(id, user.id);
  }
}
