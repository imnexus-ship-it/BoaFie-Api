import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryFreelancersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  skills?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rate_max?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  remote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating_min?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  sort?: string;
}
