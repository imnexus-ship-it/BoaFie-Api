import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { WalletService } from './wallet.service';
import { WithdrawDto } from './dto/withdraw.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getWallet(@CurrentUser() user: RequestUser) {
    return this.walletService.getWallet(user.id);
  }

  @Get('transactions')
  getTransactions(@CurrentUser() user: RequestUser, @Query() query: PaginationQueryDto) {
    return this.walletService.getTransactions(user.id, query.page, query.limit);
  }

  @Post('withdraw')
  withdraw(@CurrentUser() user: RequestUser, @Body() dto: WithdrawDto) {
    return this.walletService.withdraw(user.id, dto);
  }

  @Get('withdraw/:id/status')
  getWithdrawalStatus(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.walletService.getWithdrawalStatus(id, user.id);
  }
}
