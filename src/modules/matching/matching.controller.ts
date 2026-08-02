import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { MatchingService } from './matching.service';

@Controller()
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('jobs/:jobId/worker-matches')
  matchWorkers(@CurrentUser() user: RequestUser, @Param('jobId') jobId: string) {
    return this.matchingService.matchWorkersForJob(jobId, user.id);
  }
}
