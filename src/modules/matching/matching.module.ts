import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

@Module({
  imports: [JobsModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
