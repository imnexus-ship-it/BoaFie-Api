import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { JobsRepository } from './jobs.repository';
import { ScamDetectorService } from './scam-detector.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { SearchJobsDto } from './dto/search-jobs.dto';
import { offsetFor } from '../../common/dto/pagination.dto';
import { JobRow, toJobDto } from './job.entity';

const CLIENT_JOIN = `
  SELECT jobs.*,
    jsonb_build_object('id', u.id, 'full_name', u.full_name, 'avatar_url', u.avatar_url) AS client
  FROM jobs
  JOIN users u ON u.id = jobs.client_id
`;

@Injectable()
export class JobsService {
  constructor(
    private readonly jobs: JobsRepository,
    private readonly db: DatabaseService,
    private readonly scamDetector: ScamDetectorService,
  ) {}

  private rowToDto(row: JobRow & { client?: unknown }) {
    return toJobDto(row, row.client as any);
  }

  async search(query: SearchJobsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const conditions: string[] = [`jobs.status = 'open'`, `jobs.is_flagged = FALSE`];
    const params: unknown[] = [];

    if (query.category) {
      params.push(query.category);
      conditions.push(`jobs.category = $${params.length}`);
    }
    if (query.location) {
      params.push(`%${query.location}%`);
      conditions.push(`jobs.location_text ILIKE $${params.length}`);
    }
    if (query.budget_min !== undefined) {
      params.push(query.budget_min);
      conditions.push(`jobs.budget_max_ghs >= $${params.length}`);
    }
    if (query.budget_max !== undefined) {
      params.push(query.budget_max);
      conditions.push(`jobs.budget_min_ghs <= $${params.length}`);
    }
    if (query.diaspora !== undefined) {
      params.push(query.diaspora);
      conditions.push(`jobs.is_diaspora_job = $${params.length}`);
    }
    if (query.urgency) {
      params.push(query.urgency);
      conditions.push(`jobs.urgency = $${params.length}`);
    }

    const order = query.sort === 'budget' ? 'jobs.budget_max_ghs DESC NULLS LAST' : 'jobs.created_at DESC';
    const where = `WHERE ${conditions.join(' AND ')}`;

    const { rows: countRows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM jobs ${where}`,
      params,
    );
    const total = parseInt(countRows[0].count, 10);

    const listParams = [...params, limit, offsetFor(page, limit)];
    const { rows } = await this.db.query<JobRow & { client: unknown }>(
      `${CLIENT_JOIN} ${where} ORDER BY ${order} LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    return { items: rows.map((r) => this.rowToDto(r)), meta: { page, limit, total } };
  }

  async findById(id: string) {
    const { rows } = await this.db.query<JobRow & { client: unknown }>(
      `${CLIENT_JOIN} WHERE jobs.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Job not found');
    await this.jobs.incrementViewCount(id);
    return this.rowToDto(rows[0]);
  }

  async myPosts(clientId: string, page = 1, limit = 20) {
    const total = await this.jobs.countByClient(clientId);
    const { rows } = await this.db.query<JobRow & { client: unknown }>(
      `${CLIENT_JOIN} WHERE jobs.client_id = $1 ORDER BY jobs.created_at DESC LIMIT $2 OFFSET $3`,
      [clientId, limit, offsetFor(page, limit)],
    );
    return { items: rows.map((r) => this.rowToDto(r)), meta: { page, limit, total } };
  }

  async recommended(userId: string, role: string) {
    let category: string | null = null;
    if (role === 'artisan') {
      const { rows } = await this.db.query<{ trade_category: string }>(
        'SELECT trade_category FROM artisan_profiles WHERE user_id = $1',
        [userId],
      );
      category = rows[0]?.trade_category ?? null;
    } else if (role === 'freelancer') {
      const { rows } = await this.db.query<{ skills: string[] }>(
        'SELECT skills FROM freelancer_profiles WHERE user_id = $1',
        [userId],
      );
      category = rows[0]?.skills?.[0] ?? null;
    }

    const params: unknown[] = [];
    let where = `WHERE jobs.status = 'open' AND jobs.is_flagged = FALSE`;
    if (category) {
      params.push(category);
      where += ` AND jobs.category = $${params.length}`;
    }
    params.push(10);
    const { rows } = await this.db.query<JobRow & { client: unknown }>(
      `${CLIENT_JOIN} ${where} ORDER BY jobs.created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.rowToDto(r));
  }

  async create(clientId: string, dto: CreateJobDto) {
    const priorJobs = await this.jobs.countByClient(clientId);
    const { score, flags } = this.scamDetector.score({
      title: dto.title,
      description: dto.description,
      budgetMaxGhs: dto.budget_max_ghs ?? null,
      clientPriorJobsCount: priorJobs,
    });

    // Scam flags aren't persisted to a dedicated table in this build —
    // surfaced via is_flagged/ai_scam_score on the job itself, which the
    // admin jobs queue filters on.
    void flags;

    const job = await this.jobs.insert({
      client_id: clientId,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      subcategory: dto.subcategory ?? null,
      skills_required: dto.skills_required ?? [],
      location_text: dto.location_text ?? null,
      budget_min_ghs: dto.budget_min_ghs ?? null,
      budget_max_ghs: dto.budget_max_ghs ?? null,
      budget_type: dto.budget_type ?? 'fixed',
      deadline: dto.deadline ?? null,
      urgency: dto.urgency ?? 'normal',
      is_diaspora_job: dto.is_diaspora_job ?? false,
      diaspora_country: dto.diaspora_country ?? null,
      media_urls: dto.media_urls ?? [],
      ai_scam_score: score,
      is_flagged: score > 0.75,
    });

    return this.findById(job.id);
  }

  async update(id: string, clientId: string, dto: UpdateJobDto) {
    const job = await this.jobs.findById(id);
    if (!job) throw new NotFoundException('Job not found');
    if (job.client_id !== clientId) throw new ForbiddenException('Not your job posting');
    await this.jobs.updateById(id, dto as Record<string, unknown>);
    return this.findById(id);
  }

  async remove(id: string, clientId: string) {
    const job = await this.jobs.findById(id);
    if (!job) throw new NotFoundException('Job not found');
    if (job.client_id !== clientId) throw new ForbiddenException('Not your job posting');
    await this.jobs.deleteById(id);
  }

  async close(id: string, clientId: string) {
    const job = await this.jobs.findById(id);
    if (!job) throw new NotFoundException('Job not found');
    if (job.client_id !== clientId) throw new ForbiddenException('Not your job posting');
    await this.jobs.updateById(id, { status: 'cancelled' });
    return this.findById(id);
  }
}
