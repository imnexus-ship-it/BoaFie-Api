import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
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
  @IsString()
  sort?: string;
}
