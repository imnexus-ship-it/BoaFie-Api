import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

@Controller('contracts')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post(':contractId/disputes')
  create(@CurrentUser() user: RequestUser, @Param('contractId') contractId: string, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(contractId, user.id, dto);
  }

  @Get(':contractId/disputes')
  list(@CurrentUser() user: RequestUser, @Param('contractId') contractId: string) {
    return this.disputesService.listForContract(contractId, user.id);
  }
}
