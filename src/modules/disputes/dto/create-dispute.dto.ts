import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsUrl({}, { each: true })
  evidence_urls?: string[];
}
