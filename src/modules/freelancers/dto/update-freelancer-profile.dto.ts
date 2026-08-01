import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateFreelancerProfileDto {
  @IsOptional()
  @IsString()
  title?: string;

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
}
