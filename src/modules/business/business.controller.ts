import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { BusinessService } from './business.service';
import { CreateBusinessProfileDto } from './dto/create-business-profile.dto';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get('me')
  getMine(@CurrentUser() user: RequestUser) {
    return this.businessService.getMine(user.id);
  }

  @Post('me')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBusinessProfileDto) {
    return this.businessService.create(user.id, dto);
  }
}
