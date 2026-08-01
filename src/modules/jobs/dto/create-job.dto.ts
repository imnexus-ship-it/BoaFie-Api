import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills_required?: string[];

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
  @IsIn(['fixed', 'hourly', 'daily'])
  budget_type?: string;

  @IsOptional()
  @IsISO8601()
  deadline?: string;

  @IsOptional()
  @IsIn(['emergency', 'urgent', 'normal'])
  urgency?: string;

  @IsOptional()
  @IsBoolean()
  is_diaspora_job?: boolean;

  @IsOptional()
  @IsString()
  diaspora_country?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media_urls?: string[];
}
