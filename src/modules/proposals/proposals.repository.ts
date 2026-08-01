import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { ProposalRow } from './proposal.entity';

@Injectable()
export class ProposalsRepository extends BaseRepository<ProposalRow> {
  constructor(db: DatabaseService) {
    super(db, 'proposals');
  }
}
