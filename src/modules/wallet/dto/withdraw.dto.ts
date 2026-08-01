import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsPositive, IsString } from 'class-validator';

export class WithdrawDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount_ghs: number;

  @IsIn(['mtn_momo', 'telecel_cash', 'airteltigo', 'bank_transfer'])
  method: string;

  @IsString()
  account_number: string;

  @IsString()
  account_name: string;
}
