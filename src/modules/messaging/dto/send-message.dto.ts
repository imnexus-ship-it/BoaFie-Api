import { IsArray, IsIn, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';

/** 'system' and 'milestone_update' are posted internally only — never composable by a user. */
const USER_POSTABLE_TYPES = ['text', 'image', 'file', 'voice_note', 'video', 'quotation'];

export class SendMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsIn(USER_POSTABLE_TYPES)
  type: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  media_urls?: string[];

  /** For type 'quotation': { amount_ghs: number, description: string }. */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
