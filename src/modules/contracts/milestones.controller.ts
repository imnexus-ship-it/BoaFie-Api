import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { MilestonesService } from './milestones.service';
import { SubmitMilestoneDto, RejectMilestoneDto } from './dto/submit-milestone.dto';

@Controller('milestones')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Patch(':id/start')
  start(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.milestonesService.start(id, user.id);
  }

  @Patch(':id/submit')
  submit(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SubmitMilestoneDto) {
    return this.milestonesService.submit(id, user.id, dto.submission_note);
  }

  @Patch(':id/approve')
  approve(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.milestonesService.approve(id, user.id);
  }

  @Patch(':id/reject')
  reject(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: RejectMilestoneDto) {
    return this.milestonesService.reject(id, user.id, dto.feedback);
  }
}
