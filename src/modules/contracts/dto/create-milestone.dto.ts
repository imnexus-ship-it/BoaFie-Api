import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  amount_ghs: number;

  @IsOptional()
  @IsISO8601()
  due_date?: string;
}
