import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ArtisansService } from './artisans.service';
import { QueryArtisansDto } from './dto/query-artisans.dto';
import { CreateArtisanProfileDto } from './dto/create-artisan-profile.dto';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller('artisans')
export class ArtisansController {
  constructor(private readonly artisansService: ArtisansService) {}

  @Public()
  @Get()
  list(@Query() query: QueryArtisansDto) {
    return this.artisansService.list(query);
  }

  @Get('me')
  getMine(@CurrentUser() user: RequestUser) {
    return this.artisansService.getMine(user.id);
  }

  @Public()
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.artisansService.getById(id);
  }

  @Post('me')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateArtisanProfileDto) {
    return this.artisansService.create(user.id, dto);
  }

  @Patch('me')
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateArtisanProfileDto) {
    return this.artisansService.update(user.id, dto);
  }

  @Patch('me/availability')
  updateAvailability(@CurrentUser() user: RequestUser, @Body() dto: UpdateAvailabilityDto) {
    return this.artisansService.updateAvailability(user.id, dto);
  }
}
