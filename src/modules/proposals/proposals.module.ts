import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { ProposalsRepository } from './proposals.repository';

@Module({
  imports: [JobsModule, MessagingModule],
  controllers: [ProposalsController],
  providers: [ProposalsService, ProposalsRepository],
})
export class ProposalsModule {}
