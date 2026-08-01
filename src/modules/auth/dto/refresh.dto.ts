import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  refresh_token: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
