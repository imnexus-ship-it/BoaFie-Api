import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContractsController } from './contracts.controller';
import { MilestonesController } from './milestones.controller';
import { ContractsService } from './contracts.service';
import { MilestonesService } from './milestones.service';
import { CommissionService } from './commission.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ContractsController, MilestonesController],
  providers: [ContractsService, MilestonesService, CommissionService],
  exports: [CommissionService],
})
export class ContractsModule {}
