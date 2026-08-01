import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BaseRepository } from '../../database/base.repository';
import { JobRow } from './job.entity';

@Injectable()
export class JobsRepository extends BaseRepository<JobRow> {
  constructor(db: DatabaseService) {
    super(db, 'jobs');
  }

  async incrementViewCount(id: string) {
    await this.db.query('UPDATE jobs SET view_count = view_count + 1 WHERE id = $1', [id]);
  }

  async incrementProposalCount(id: string) {
    await this.db.query('UPDATE jobs SET proposal_count = proposal_count + 1 WHERE id = $1', [id]);
  }

  countByClient(clientId: string) {
    return this.count({ client_id: clientId });
  }
}
