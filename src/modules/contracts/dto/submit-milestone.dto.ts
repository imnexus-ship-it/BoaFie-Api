import { IsString, MinLength } from 'class-validator';

export class SubmitMilestoneDto {
  @IsString()
  @MinLength(1)
  submission_note: string;
}

export class RejectMilestoneDto {
  @IsString()
  @MinLength(1)
  feedback: string;
}
