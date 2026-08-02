import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { JobsRepository } from './jobs.repository';
import { ScamDetectorService } from './scam-detector.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { SearchJobsDto } from './dto/search-jobs.dto';
import { offsetFor } from '../../common/dto/pagination.dto';
import { scoreMatch, overlapCount } from '../../common/matching/score';
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

  /**
   * "Matched for you" — scores the open-jobs pool against the worker's own
   * profile (category/skill overlap, location, rate fit, urgency) instead
   * of the old exact-category-only filter. Falls back to plain recency
   * when nothing scores above zero (e.g. a brand-new worker with no
   * skills set yet), so the section is never empty once there's any open
   * work at all.
   */
  async recommended(userId: string, role: string) {
    if (role === 'artisan') {
      const { rows } = await this.db.query<{
        trade_category: string;
        trade_subcategories: string[];
        hourly_rate_ghs: string | null;
      }>('SELECT trade_category, trade_subcategories, hourly_rate_ghs FROM artisan_profiles WHERE user_id = $1', [
        userId,
      ]);
      const profile = rows[0];
      if (!profile) return [];
      return this.scoredOpenJobsFor({
        categorySlug: profile.trade_category,
        skills: profile.trade_subcategories ?? [],
        hourlyRateGhs: profile.hourly_rate_ghs,
        isRemoteWorker: false,
      });
    }
    if (role === 'freelancer') {
      const { rows } = await this.db.query<{
        skills: string[];
        hourly_rate_ghs: string | null;
        remote_only: boolean;
      }>('SELECT skills, hourly_rate_ghs, remote_only FROM freelancer_profiles WHERE user_id = $1', [userId]);
      const profile = rows[0];
      if (!profile) return [];
      return this.scoredOpenJobsFor({
        categorySlug: null,
        skills: profile.skills ?? [],
        hourlyRateGhs: profile.hourly_rate_ghs,
        isRemoteWorker: profile.remote_only,
      });
    }
    return [];
  }

  private async scoredOpenJobsFor(worker: {
    categorySlug: string | null;
    skills: string[];
    hourlyRateGhs: string | null;
    isRemoteWorker: boolean;
  }) {
    const { rows } = await this.db.query<JobRow & { client: unknown }>(
      `${CLIENT_JOIN} WHERE jobs.status = 'open' AND jobs.is_flagged = FALSE ORDER BY jobs.created_at DESC LIMIT 50`,
    );

    const scored = rows.map((row) => {
      let rateFit: 'good' | 'neutral' | 'none' = 'neutral';
      if (
        row.budget_type === 'hourly' &&
        worker.hourlyRateGhs !== null &&
        row.budget_min_ghs !== null &&
        row.budget_max_ghs !== null
      ) {
        const rate = Number(worker.hourlyRateGhs);
        const min = Number(row.budget_min_ghs) * 0.7;
        const max = Number(row.budget_max_ghs) * 1.3;
        rateFit = rate >= min && rate <= max ? 'good' : 'none';
      }
      const score = scoreMatch({
        categoryExactMatch: worker.categorySlug !== null && row.category === worker.categorySlug,
        skillOverlapCount: overlapCount(worker.skills, row.skills_required),
        locationMatch: row.is_remote ? worker.isRemoteWorker : false,
        rateFit,
        urgentJob: row.urgency === 'emergency',
        workerAvailable: true,
        trackRecord: 0,
      });
      return { row, score };
    });

    const ranked = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || +new Date(b.row.created_at) - +new Date(a.row.created_at));
    const chosen = ranked.length > 0 ? ranked : scored;
    return chosen.slice(0, 10).map((s) => this.rowToDto(s.row));
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
