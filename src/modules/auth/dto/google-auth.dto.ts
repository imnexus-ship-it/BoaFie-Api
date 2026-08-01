import { IsIn, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  id_token: string;

  @IsOptional()
  @IsIn(['client', 'artisan', 'freelancer'])
  role?: 'client' | 'artisan' | 'freelancer';
}
