import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsRepository } from './jobs.repository';
import { ScamDetectorService } from './scam-detector.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, JobsRepository, ScamDetectorService],
  exports: [JobsRepository],
})
export class JobsModule {}
