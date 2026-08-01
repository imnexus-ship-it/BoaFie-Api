import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreatePortfolioItemDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media_urls?: string[];

  @IsOptional()
  @IsString()
  category?: string;
}
