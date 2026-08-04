import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { UsersService } from './users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Delete('me')
  @HttpCode(200)
  deleteMe(@CurrentUser() user: RequestUser) {
    return this.usersService.deleteMe(user.id);
  }

  @Get('me/dashboard')
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.usersService.getDashboard(user.id, user.role);
  }

  @Get('me/notifications')
  listNotifications(@CurrentUser() user: RequestUser, @Query() query: PaginationQueryDto) {
    return this.notificationsService.listForUser(user.id, query.page, query.limit);
  }

  @Patch('me/notifications/read-all')
  markAllNotificationsRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch('me/notifications/:id/read')
  markNotificationRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Get('me/notification-preferences')
  getNotificationPreferences(@CurrentUser() user: RequestUser) {
    return this.usersService.getNotificationPreferences(user.id);
  }

  @Patch('me/notification-preferences')
  updateNotificationPreferences(@CurrentUser() user: RequestUser, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.usersService.updateNotificationPreferences(user.id, dto);
  }

  @Public()
  @Get(':id/public')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
