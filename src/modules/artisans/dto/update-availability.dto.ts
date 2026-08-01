import { IsIn } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsIn(['available', 'busy', 'unavailable'])
  availability: 'available' | 'busy' | 'unavailable';
}
