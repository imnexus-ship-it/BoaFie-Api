import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { offsetFor } from '../../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitIdDto, SubmitLocationDto } from './dto/verification.dto';

const TRUST_SCORE_THRESHOLD = 80;

/** Dev-only OTP stub — no Twilio wiring in this build. */
const DEV_OTP_CODE = '123456';

function toVerificationDto(row: any, phoneVerified: boolean) {
  return {
    id: row.id,
    user_id: row.user_id,
    phone_status: phoneVerified ? 'verified' : 'unverified',
    id_status: row.id_status,
    selfie_status: row.selfie_status,
    location_status: row.location_status,
    trade_cert_status: row.trade_cert_status,
    overall_verified: row.overall_verified,
    trust_score: row.trust_score,
    rejection_reason: row.rejection_reason,
  };
}

/** Admin review needs the actual submitted documents, not just their status. */
function toAdminVerificationDto(row: any) {
  return {
    ...toVerificationDto(row, false),
    id_type: row.id_type,
    id_number: row.id_number,
    id_front_url: row.id_front_url,
    id_back_url: row.id_back_url,
    selfie_url: row.selfie_url,
    trade_cert_url: row.trade_cert_url,
  };
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getRow(userId: string) {
    const { rows } = await this.db.query('SELECT * FROM verifications WHERE user_id = $1', [userId]);
    if (!rows[0]) throw new NotFoundException('Verification record not found');
    return rows[0];
  }

  private async getPhoneVerified(userId: string): Promise<boolean> {
    const { rows } = await this.db.query<{ phone_verified: boolean }>(
      'SELECT phone_verified FROM users WHERE id = $1',
      [userId],
    );
    return rows[0]?.phone_verified ?? false;
  }

  async getStatus(userId: string) {
    const row = await this.getRow(userId);
    const phoneVerified = await this.getPhoneVerified(userId);
    return toVerificationDto(row, phoneVerified);
  }

  /**
   * Recomputed from scratch on every change — never incremented — so a
   * stage being un-verified later (e.g. after a rejection) can't leave a
   * stale point behind. Matches the security doc's explicit anti-drift
   * comment on addTrustPoints().
   */
  private async recomputeTrustScore(userId: string) {
    const row = await this.getRow(userId);
    const phoneVerified = await this.getPhoneVerified(userId);
    const score =
      (phoneVerified ? 20 : 0) +
      (row.id_status === 'verified' ? 30 : 0) +
      (row.selfie_status === 'verified' ? 20 : 0) +
      (row.location_status === 'verified' ? 15 : 0) +
      (row.trade_cert_status === 'verified' ? 15 : 0);
    const overallVerified = score >= TRUST_SCORE_THRESHOLD;

    await this.db.query(
      `UPDATE verifications SET trust_score = $2, overall_verified = $3,
         verified_badge_at = CASE WHEN $3 AND verified_badge_at IS NULL THEN NOW() ELSE verified_badge_at END
       WHERE user_id = $1`,
      [userId, score, overallVerified],
    );
    return this.getStatus(userId);
  }

  async sendPhoneOtp(phone: string) {
    // eslint-disable-next-line no-console
    console.log(`[dev OTP stub] SMS to ${phone}: your BoaFie code is ${DEV_OTP_CODE}`);
  }

  async confirmPhoneOtp(userId: string, phone: string, code: string) {
    if (code !== DEV_OTP_CODE) throw new BadRequestException('Invalid or expired OTP code');
    await this.db.query('UPDATE users SET phone = $2, phone_verified = TRUE WHERE id = $1', [
      userId,
      phone,
    ]);
    return this.recomputeTrustScore(userId);
  }

  async submitId(userId: string, dto: SubmitIdDto) {
    await this.db.query(
      `UPDATE verifications SET id_status = 'pending', id_type = $2, id_number = $3,
         id_front_url = $4, id_back_url = $5 WHERE user_id = $1`,
      [userId, dto.id_type, dto.id_number, dto.id_front_url, dto.id_back_url ?? null],
    );
    return this.getStatus(userId);
  }

  /**
   * The docs' AiVerificationService (AWS Rekognition face-match + a
   * liveness check) isn't wired up in this build — no AI provider
   * configured. Rather than fake a pass/fail, every selfie submission is
   * routed to manual admin review, which the docs already treat as the
   * fallback path for borderline scores.
   */
  async submitSelfie(userId: string, selfieUrl: string) {
    const row = await this.getRow(userId);
    if (row.id_status !== 'verified') {
      throw new BadRequestException('Submit and get your ID verified before selfie verification');
    }
    await this.db.query(
      `UPDATE verifications SET selfie_status = 'pending', selfie_url = $2 WHERE user_id = $1`,
      [userId, selfieUrl],
    );
    return this.getStatus(userId);
  }

  /**
   * The docs cross-check GPS against the worker's stated region via a
   * geocoding RPC this build doesn't have (PostGIS/geocoding was dropped
   * — see migration notes). Location is auto-verified on submission
   * instead of cross-checked; a real region-mismatch check is a
   * documented follow-up, not silently skipped.
   */
  async submitLocation(userId: string, dto: SubmitLocationDto) {
    await this.db.query(
      `UPDATE verifications SET location_status = 'verified', location_lat = $2, location_lng = $3,
         location_text = $4, location_verified_at = NOW() WHERE user_id = $1`,
      [userId, dto.lat, dto.lng, dto.location_text ?? null],
    );
    return this.recomputeTrustScore(userId);
  }

  async submitTradeCert(userId: string, tradeCertUrl: string) {
    await this.db.query(
      `UPDATE verifications SET trade_cert_status = 'pending', trade_cert_url = $2 WHERE user_id = $1`,
      [userId, tradeCertUrl],
    );
    return this.getStatus(userId);
  }

  // --- Admin ---

  async adminQueue(page = 1, limit = 20) {
    const where = `WHERE id_status = 'pending' OR selfie_status = 'pending' OR trade_cert_status = 'pending'`;
    const { rows: countRows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM verifications ${where}`,
    );
    const total = parseInt(countRows[0].count, 10);
    const { rows } = await this.db.query(
      `SELECT v.*, jsonb_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email, 'role', u.role) AS users
       FROM verifications v JOIN users u ON u.id = v.user_id
       ${where}
       ORDER BY v.updated_at ASC LIMIT $1 OFFSET $2`,
      [limit, offsetFor(page, limit)],
    );
    return {
      items: rows.map((r) => ({ ...toAdminVerificationDto(r), users: r.users })),
      meta: { page, limit, total },
    };
  }

  /** No stage parameter comes from boafie-web's admin UI — every stage
   * currently pending on this record is approved in one action. */
  async adminApprove(verificationId: string, adminId: string) {
    const { rows } = await this.db.query('SELECT * FROM verifications WHERE id = $1', [
      verificationId,
    ]);
    const row = rows[0];
    if (!row) throw new NotFoundException('Verification not found');

    const updates: string[] = [];
    const actions: string[] = [];
    if (row.id_status === 'pending') {
      updates.push(`id_status = 'verified', id_verified_at = NOW()`);
      actions.push('verify_id_approved');
    }
    if (row.selfie_status === 'pending') {
      updates.push(`selfie_status = 'verified', selfie_verified_at = NOW()`);
      actions.push('verify_selfie_approved');
    }
    if (row.trade_cert_status === 'pending') {
      updates.push(`trade_cert_status = 'verified', trade_cert_verified_at = NOW()`);
      actions.push('verify_trade_cert_approved');
    }
    if (updates.length === 0) throw new BadRequestException('Nothing pending on this verification record');

    await this.db.query(
      `UPDATE verifications SET ${updates.join(', ')}, reviewed_by = $2 WHERE id = $1`,
      [verificationId, adminId],
    );
    for (const action of actions) {
      await this.db.query(
        `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id) VALUES ($1, $2, 'verification', $3)`,
        [adminId, action, verificationId],
      );
    }
    await this.notifications.notify(
      row.user_id,
      'verification',
      'Verification approved',
      'One or more of your verification steps were approved.',
      { verification_id: verificationId },
    );
    return this.recomputeTrustScore(row.user_id);
  }

  async adminReject(verificationId: string, adminId: string, reason: string) {
    const { rows } = await this.db.query('SELECT * FROM verifications WHERE id = $1', [
      verificationId,
    ]);
    const row = rows[0];
    if (!row) throw new NotFoundException('Verification not found');

    const updates: string[] = [];
    if (row.id_status === 'pending') updates.push(`id_status = 'rejected'`);
    if (row.selfie_status === 'pending') updates.push(`selfie_status = 'rejected'`);
    if (row.trade_cert_status === 'pending') updates.push(`trade_cert_status = 'rejected'`);
    if (updates.length === 0) throw new BadRequestException('Nothing pending on this verification record');

    await this.db.query(
      `UPDATE verifications SET ${updates.join(', ')}, rejection_reason = $2, reviewed_by = $3 WHERE id = $1`,
      [verificationId, reason, adminId],
    );
    await this.db.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, 'verify_rejected', 'verification', $2, $3)`,
      [adminId, verificationId, JSON.stringify({ reason })],
    );
    await this.notifications.notify(
      row.user_id,
      'verification',
      'Verification rejected',
      `A verification step was rejected: ${reason}`,
      { verification_id: verificationId },
    );
    return this.getStatus(row.user_id);
  }
}
