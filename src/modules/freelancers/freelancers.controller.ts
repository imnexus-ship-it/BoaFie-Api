import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { FreelancersService } from './freelancers.service';
import { QueryFreelancersDto } from './dto/query-freelancers.dto';
import { CreateFreelancerProfileDto } from './dto/create-freelancer-profile.dto';
import { UpdateFreelancerProfileDto } from './dto/update-freelancer-profile.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller('freelancers')
export class FreelancersController {
  constructor(private readonly freelancersService: FreelancersService) {}

  @Public()
  @Get()
  list(@Query() query: QueryFreelancersDto) {
    return this.freelancersService.list(query);
  }

  @Get('me')
  getMine(@CurrentUser() user: RequestUser) {
    return this.freelancersService.getMine(user.id);
  }

  @Public()
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.freelancersService.getById(id);
  }

  @Post('me')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateFreelancerProfileDto) {
    return this.freelancersService.create(user.id, dto);
  }

  @Patch('me')
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateFreelancerProfileDto) {
    return this.freelancersService.update(user.id, dto);
  }

  @Patch('me/availability')
  updateAvailability(@CurrentUser() user: RequestUser, @Body() dto: UpdateAvailabilityDto) {
    return this.freelancersService.updateAvailability(user.id, dto);
  }
}
