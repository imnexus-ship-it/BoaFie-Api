import { IsIn, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  content: string;

  @IsIn(['text', 'image', 'file', 'voice_note', 'video', 'system'])
  type: string;
}
