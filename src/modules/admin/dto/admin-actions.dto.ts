import { IsIn, IsOptional, IsString } from 'class-validator';

export class SuspendUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectVerificationDto {
  @IsString()
  reason: string;
}

export class ResolveDisputeDto {
  @IsIn(['resolved_client', 'resolved_worker', 'escalated'])
  outcome: string;

  @IsString()
  resolution_note: string;
}
