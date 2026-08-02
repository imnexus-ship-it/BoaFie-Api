import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateArtisanProfileDto {
  @IsString()
  trade_category: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trade_subcategories?: string[];

  @IsOptional()
  @IsNumber()
  years_experience?: number;

  @IsOptional()
  @IsNumber()
  hourly_rate_ghs?: number;

  @IsOptional()
  @IsString()
  location_text?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  ai_bio?: string;
}
