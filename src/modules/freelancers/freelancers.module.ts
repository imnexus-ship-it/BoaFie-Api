import { Module } from '@nestjs/common';
import { FreelancersController } from './freelancers.controller';
import { FreelancersService } from './freelancers.service';
import { FreelancersRepository } from './freelancers.repository';

@Module({
  controllers: [FreelancersController],
  providers: [FreelancersService, FreelancersRepository],
})
export class FreelancersModule {}
