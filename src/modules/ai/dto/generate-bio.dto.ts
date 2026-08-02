import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GenerateBioDto {
  @IsIn(['artisan', 'freelancer'])
  role: 'artisan' | 'freelancer';

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  years_experience?: number;

  @IsOptional()
  @IsString()
  location_text?: string;
}
