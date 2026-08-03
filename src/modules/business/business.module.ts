import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { BusinessRepository } from './business.repository';

@Module({
  controllers: [BusinessController],
  providers: [BusinessService, BusinessRepository],
})
export class BusinessModule {}
