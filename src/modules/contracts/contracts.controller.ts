import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ContractsService } from './contracts.service';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly milestonesService: MilestonesService,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: PaginationQueryDto) {
    return this.contractsService.list(user.id, query.page, query.limit);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.contractsService.findById(id, user.id);
  }

  @Patch(':id/complete')
  complete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.contractsService.complete(id, user.id);
  }

  @Get(':contractId/milestones')
  listMilestones(@CurrentUser() user: RequestUser, @Param('contractId') contractId: string) {
    return this.milestonesService.listForContract(contractId, user.id);
  }

  @Post(':contractId/milestones')
  createMilestone(
    @CurrentUser() user: RequestUser,
    @Param('contractId') contractId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.milestonesService.create(contractId, user.id, dto);
  }
}
