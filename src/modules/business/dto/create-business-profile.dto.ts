import { IsOptional, IsString } from 'class-validator';

export class CreateBusinessProfileDto {
  @IsString()
  legal_business_name: string;

  @IsOptional()
  @IsString()
  trading_name?: string;

  @IsOptional()
  @IsString()
  business_type?: string;

  @IsOptional()
  @IsString()
  registration_number?: string;

  @IsOptional()
  @IsString()
  tax_id?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  business_email?: string;

  @IsOptional()
  @IsString()
  business_phone?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  city?: string;
}
