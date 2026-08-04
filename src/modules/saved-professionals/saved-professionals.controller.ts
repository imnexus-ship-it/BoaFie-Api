import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { SavedProfessionalsService } from './saved-professionals.service';
import { SaveProfessionalDto } from './dto/save-professional.dto';

@Controller('users/me/saved-professionals')
export class SavedProfessionalsController {
  constructor(private readonly savedProfessionalsService: SavedProfessionalsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.savedProfessionalsService.list(user.id);
  }

  @Post()
  save(@CurrentUser() user: RequestUser, @Body() dto: SaveProfessionalDto) {
    return this.savedProfessionalsService.save(user.id, dto.worker_user_id);
  }

  @Delete(':workerUserId')
  unsave(@CurrentUser() user: RequestUser, @Param('workerUserId') workerUserId: string) {
    return this.savedProfessionalsService.unsave(user.id, workerUserId);
  }
}
