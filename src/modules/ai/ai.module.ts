import { Module } from '@nestjs/common';
import { ArtisansModule } from '../artisans/artisans.module';
import { FreelancersModule } from '../freelancers/freelancers.module';
import { JobsModule } from '../jobs/jobs.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [ArtisansModule, FreelancersModule, JobsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
