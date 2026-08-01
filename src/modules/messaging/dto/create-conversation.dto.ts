import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  participant_ids: string[];

  @IsOptional()
  @IsUUID()
  job_id?: string;

  @IsOptional()
  @IsUUID()
  contract_id?: string;
}
