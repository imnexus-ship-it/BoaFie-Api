import { IsUUID } from 'class-validator';

export class SaveProfessionalDto {
  @IsUUID()
  worker_user_id: string;
}
