import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { UserRow } from './user.entity';

@Injectable()
export class UsersRepository extends BaseRepository<UserRow> {
  constructor(db: DatabaseService) {
    super(db, 'users');
  }

  findByEmail(email: string) {
    return this.findOne({ email });
  }

  findByPhone(phone: string) {
    return this.findOne({ phone });
  }
}
