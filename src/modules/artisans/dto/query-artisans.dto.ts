import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryArtisansDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(['available', 'busy', 'unavailable'])
  availability?: 'available' | 'busy' | 'unavailable';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rate_max?: number;

  @IsOptional()
  @IsString()
  sort?: string;
}
