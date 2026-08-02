import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { JobsRepository } from '../jobs/jobs.repository';
import { JobRow } from '../jobs/job.entity';
import { ArtisanProfileWithUser, toArtisanProfile } from '../artisans/artisan-profile.entity';
import { FreelancerProfileWithUser, toFreelancerProfile } from '../freelancers/freelancer-profile.entity';
import { scoreMatch, overlapCount } from '../../common/matching/score';

const USER_FIELDS = `jsonb_build_object('id', u.id, 'full_name', u.full_name, 'avatar_url', u.avatar_url, 'bio', u.bio, 'status', u.status) AS users`;

@Injectable()
export class MatchingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jobs: JobsRepository,
  ) {}

  async matchWorkersForJob(jobId: string, clientId: string) {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if (job.client_id !== clientId) {
      throw new ForbiddenException('Only the job owner can view worker matches');
    }

    const skills = job.skills_required ?? [];

    const [artisanRows, freelancerRows] = await Promise.all([
      this.db.query<ArtisanProfileWithUser>(
        `SELECT ap.*, ${USER_FIELDS} FROM artisan_profiles ap JOIN users u ON u.id = ap.user_id
         WHERE ap.trade_category = $1 OR ap.trade_subcategories && $2::text[]
         ORDER BY ap.total_jobs_done DESC LIMIT 30`,
        [job.category, skills],
      ),
      skills.length
        ? this.db.query<FreelancerProfileWithUser>(
            `SELECT fp.*, ${USER_FIELDS} FROM freelancer_profiles fp JOIN users u ON u.id = fp.user_id
             WHERE fp.skills && $1::text[]
             ORDER BY fp.total_jobs_done DESC LIMIT 30`,
            [skills],
          )
        : Promise.resolve({ rows: [] as FreelancerProfileWithUser[] }),
    ]);

    const artisanMatches = artisanRows.rows.map((row) => {
      const score = scoreMatch({
        categoryExactMatch: row.trade_category === job.category,
        skillOverlapCount: overlapCount(row.trade_subcategories, skills),
        locationMatch: !job.is_remote && !!job.region && row.region === job.region,
        rateFit: this.rateFitFor(job, row.hourly_rate_ghs),
        urgentJob: job.urgency === 'emergency',
        workerAvailable: row.availability === 'available',
        trackRecord: row.total_jobs_done,
      });
      return { type: 'artisan' as const, score, profile: toArtisanProfile(row) };
    });

    const freelancerMatches = freelancerRows.rows.map((row) => {
      const score = scoreMatch({
        categoryExactMatch: false,
        skillOverlapCount: overlapCount(row.skills, skills),
        locationMatch: job.is_remote ? row.remote_only : !!job.region && row.region === job.region,
        rateFit: this.rateFitFor(job, row.hourly_rate_ghs),
        urgentJob: job.urgency === 'emergency',
        workerAvailable: row.availability === 'available',
        trackRecord: row.total_jobs_done,
      });
      return { type: 'freelancer' as const, score, profile: toFreelancerProfile(row) };
    });

    return [...artisanMatches, ...freelancerMatches]
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private rateFitFor(job: JobRow, hourlyRateGhs: string | null): 'good' | 'neutral' | 'none' {
    if (job.budget_type !== 'hourly' || hourlyRateGhs === null || job.budget_min_ghs === null || job.budget_max_ghs === null) {
      return 'neutral';
    }
    const rate = Number(hourlyRateGhs);
    const min = Number(job.budget_min_ghs) * 0.7;
    const max = Number(job.budget_max_ghs) * 1.3;
    return rate >= min && rate <= max ? 'good' : 'none';
  }
}
