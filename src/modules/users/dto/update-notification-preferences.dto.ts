import { IsBoolean, IsOptional } from 'class-validator';

/** One optional boolean per toggleable NotificationType (see notification.entity.ts). */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  proposal?: boolean;

  @IsOptional()
  @IsBoolean()
  message?: boolean;

  @IsOptional()
  @IsBoolean()
  milestone?: boolean;

  @IsOptional()
  @IsBoolean()
  payment?: boolean;

  @IsOptional()
  @IsBoolean()
  verification?: boolean;

  @IsOptional()
  @IsBoolean()
  review?: boolean;

  @IsOptional()
  @IsBoolean()
  review_reminder?: boolean;

  @IsOptional()
  @IsBoolean()
  security?: boolean;
}
