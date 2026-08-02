import { IsString } from 'class-validator';

export class GenerateProposalDraftDto {
  @IsString()
  job_id: string;
}
