import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  @MinLength(10)
  cover_letter: string;

  @Type(() => Number)
  @IsNumber()
  proposed_rate: number;

  @IsOptional()
  @IsIn(['fixed', 'hourly', 'daily'])
  rate_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  estimated_days?: number;
}
