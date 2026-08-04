import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewRow, ReviewerJoin, toReviewDto } from './review.entity';

/** How long after completion a client is nudged to leave a review, if they haven't already. */
const REVIEW_REMINDER_DELAY_DAYS = 3;

const REVIEWER_JOIN = `
  SELECT reviews.*,
    jsonb_build_object('id', u.id, 'full_name', u.full_name, 'avatar_url', u.avatar_url) AS reviewer
  FROM reviews
  JOIN users u ON u.id = reviews.reviewer_id
`;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(contractId: string, reviewerId: string, dto: CreateReviewDto) {
    const { rows } = await this.db.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
    const contract = rows[0];
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.client_id !== reviewerId) throw new ForbiddenException('Only the client can review this contract');
    if (contract.status !== 'completed') throw new BadRequestException('Contract must be completed before it can be reviewed');

    const { rows: existing } = await this.db.query(
      'SELECT 1 FROM reviews WHERE contract_id = $1 AND reviewer_id = $2',
      [contractId, reviewerId],
    );
    if (existing[0]) throw new ConflictException('You already reviewed this contract');

    const { rows: inserted } = await this.db.query<ReviewRow>(
      `INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [contractId, reviewerId, contract.worker_id, dto.rating, dto.comment ?? null],
    );

    await this.notifications.notify(
      contract.worker_id,
      'review',
      'You received a new review',
      `You were rated ${dto.rating}/5 for "${contract.title}"`,
      { contract_id: contractId, review_id: inserted[0].id },
    );

    return toReviewDto(inserted[0]);
  }

  /**
   * Nudges a client once per contract, REVIEW_REMINDER_DELAY_DAYS after
   * completion, if they haven't reviewed yet. Idempotent via the
   * NOT EXISTS check against notifications already sent for that
   * contract, rather than a separate "reminded" flag — no schema needed.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async sendReviewReminders() {
    const { rows } = await this.db.query<{ id: string; client_id: string; title: string }>(
      `SELECT c.id, c.client_id, c.title
       FROM contracts c
       WHERE c.status = 'completed'
         AND c.updated_at < NOW() - ($1 || ' days')::interval
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.contract_id = c.id AND r.reviewer_id = c.client_id)
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.user_id = c.client_id AND n.type = 'review_reminder' AND n.data->>'contract_id' = c.id::text
         )`,
      [REVIEW_REMINDER_DELAY_DAYS],
    );

    for (const c of rows) {
      await this.notifications.notify(
        c.client_id,
        'review_reminder',
        'How did it go?',
        `Leave a review for "${c.title}" to help other clients find great professionals.`,
        { contract_id: c.id },
      );
    }
  }

  async listForWorker(workerId: string) {
    const { rows } = await this.db.query<ReviewRow & { reviewer: ReviewerJoin }>(
      `${REVIEWER_JOIN} WHERE reviews.reviewee_id = $1 AND reviews.is_public = TRUE ORDER BY reviews.created_at DESC`,
      [workerId],
    );
    const { rows: aggRows } = await this.db.query<{ average: string | null; count: string }>(
      `SELECT AVG(rating)::numeric(3,2) AS average, COUNT(*) AS count FROM reviews WHERE reviewee_id = $1 AND is_public = TRUE`,
      [workerId],
    );

    return {
      items: rows.map(toReviewDto),
      average_rating: aggRows[0]?.average ? Number(aggRows[0].average) : null,
      count: parseInt(aggRows[0]?.count ?? '0', 10),
    };
  }
}
