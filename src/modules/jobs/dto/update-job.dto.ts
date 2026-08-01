import { IsArray, IsBoolean, IsIn, IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  location_text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  budget_min_ghs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  budget_max_ghs?: number;

  @IsOptional()
  @IsISO8601()
  deadline?: string;

  @IsOptional()
  @IsIn(['emergency', 'urgent', 'normal'])
  urgency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media_urls?: string[];

  @IsOptional()
  @IsBoolean()
  is_diaspora_job?: boolean;
}
