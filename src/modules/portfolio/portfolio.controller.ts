import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioItemDto } from './dto/create-portfolio-item.dto';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.portfolioService.list(user.id);
  }

  @Public()
  @Get('user/:userId')
  listPublic(@Param('userId') userId: string) {
    return this.portfolioService.list(userId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePortfolioItemDto) {
    return this.portfolioService.create(user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.portfolioService.remove(id, user.id);
  }

  @Patch(':id/feature')
  toggleFeature(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.portfolioService.toggleFeature(id, user.id);
  }
}
