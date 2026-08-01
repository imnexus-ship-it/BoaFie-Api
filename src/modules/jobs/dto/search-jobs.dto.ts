import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchJobsDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  budget_min?: number;

  @IsOptional()
  @Type(() => Number)
  budget_max?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  diaspora?: boolean;

  @IsOptional()
  @IsIn(['emergency', 'urgent', 'normal'])
  urgency?: string;

  @IsOptional()
  @IsIn(['recent', 'budget', 'relevance'])
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
