import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFreelancerProfileDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsNumber()
  hourly_rate_ghs?: number;

  @IsOptional()
  @IsBoolean()
  remote_only?: boolean;

  @IsOptional()
  @IsString()
  location_text?: string;

  @IsOptional()
  @IsString()
  ai_bio?: string;
}
