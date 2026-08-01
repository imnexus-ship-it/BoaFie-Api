import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { VerificationService } from '../verification/verification.service';
import { SuspendUserDto, RejectVerificationDto, ResolveDisputeDto } from './dto/admin-actions.dto';
import { AdminUsersQueryDto, AdminJobsQueryDto, AdminPageQueryDto } from './dto/admin-queries.dto';

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly verificationService: VerificationService,
  ) {}

  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  @Get('users')
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.listUsers(query.page, 20, query.role, query.status);
  }

  @Patch('users/:id/suspend')
  suspendUser(@CurrentUser() admin: RequestUser, @Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminService.suspendUser(id, admin.id, dto);
  }

  @Patch('users/:id/ban')
  banUser(@CurrentUser() admin: RequestUser, @Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminService.banUser(id, admin.id, dto);
  }

  @Patch('users/:id/reinstate')
  reinstateUser(@CurrentUser() admin: RequestUser, @Param('id') id: string) {
    return this.adminService.reinstateUser(id, admin.id);
  }

  @Get('verifications')
  verificationQueue(@Query() query: AdminPageQueryDto) {
    return this.verificationService.adminQueue(query.page, 20);
  }

  @Patch('verifications/:id/approve')
  approveVerification(@CurrentUser() admin: RequestUser, @Param('id') id: string) {
    return this.verificationService.adminApprove(id, admin.id);
  }

  @Patch('verifications/:id/reject')
  rejectVerification(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.verificationService.adminReject(id, admin.id, dto.reason);
  }

  @Get('jobs')
  listJobs(@Query() query: AdminJobsQueryDto) {
    return this.adminService.listJobs(query.page, 20, query.status, query.flagged);
  }

  @Patch('jobs/:id/remove')
  removeJob(@CurrentUser() admin: RequestUser, @Param('id') id: string) {
    return this.adminService.removeJob(id, admin.id);
  }

  @Get('transactions')
  listTransactions(@Query() query: AdminPageQueryDto) {
    return this.adminService.listTransactions(query.page, 20);
  }

  @Get('commissions')
  commissions() {
    return this.adminService.commissionSummary();
  }

  @Get('audit-log')
  auditLog(@Query() query: AdminPageQueryDto) {
    return this.adminService.auditLog(query.page, 20);
  }

  @Get('disputes')
  listDisputes(@Query() query: AdminPageQueryDto) {
    return this.adminService.listDisputes(query.page, 20);
  }

  @Patch('disputes/:id/resolve')
  resolveDispute(@CurrentUser() admin: RequestUser, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.adminService.resolveDispute(id, admin.id, dto);
  }
}
