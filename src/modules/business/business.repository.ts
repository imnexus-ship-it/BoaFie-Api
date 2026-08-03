import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { BusinessProfileRow } from './business-profile.entity';

@Injectable()
export class BusinessRepository extends BaseRepository<BusinessProfileRow> {
  constructor(db: DatabaseService) {
    super(db, 'business_profiles');
  }

  findByUserId(userId: string): Promise<BusinessProfileRow | null> {
    return this.findOne({ user_id: userId });
  }
}
