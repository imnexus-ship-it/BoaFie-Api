import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessRepository } from './business.repository';
import { toBusinessProfile } from './business-profile.entity';
import { CreateBusinessProfileDto } from './dto/create-business-profile.dto';

@Injectable()
export class BusinessService {
  constructor(private readonly business: BusinessRepository) {}

  async getMine(userId: string) {
    const row = await this.business.findByUserId(userId);
    if (!row) throw new NotFoundException('Business profile not found');
    return toBusinessProfile(row);
  }

  async create(userId: string, dto: CreateBusinessProfileDto) {
    const existing = await this.business.findByUserId(userId);
    if (existing) throw new ConflictException('Business profile already exists');
    const row = await this.business.insert({ ...dto, user_id: userId });
    return toBusinessProfile(row);
  }
}
