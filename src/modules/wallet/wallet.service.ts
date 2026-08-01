import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { offsetFor } from '../../common/dto/pagination.dto';
import { WithdrawDto } from './dto/withdraw.dto';

const WITHDRAWAL_VELOCITY_LIMIT = 3;
const ESCROW_HOLD_HOURS = 48;

function toTransactionDto(row: any) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    description: row.description,
    created_at: row.created_at,
    commission_rate: row.commission_rate === null ? null : Number(row.commission_rate),
    commission_amount: row.commission_amount === null ? null : Number(row.commission_amount),
    net_amount: row.net_amount === null ? null : Number(row.net_amount),
  };
}

@Injectable()
export class WalletService {
  constructor(private readonly db: DatabaseService) {}

  async getWallet(userId: string) {
    const { rows } = await this.db.query(
      'SELECT id, user_id, balance_ghs, pending_ghs, lifetime_earned, currency FROM wallets WHERE user_id = $1',
      [userId],
    );
    const wallet = rows[0];
    if (!wallet) throw new NotFoundException('Wallet not found');
    return {
      id: wallet.id,
      user_id: wallet.user_id,
      balance_ghs: Number(wallet.balance_ghs),
      pending_ghs: Number(wallet.pending_ghs),
      lifetime_earned: Number(wallet.lifetime_earned),
      currency: wallet.currency,
    };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const { rows: countRows } = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) FROM transactions WHERE user_id = $1',
      [userId],
    );
    const total = parseInt(countRows[0].count, 10);
    const { rows } = await this.db.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offsetFor(page, limit)],
    );
    return { items: rows.map(toTransactionDto), meta: { page, limit, total } };
  }

  /**
   * Payout itself is stubbed (no live MoMo/bank rail wired up) — this
   * records a pending withdrawal and debits the wallet immediately, same
   * as the docs' flow, but never calls an external payout provider.
   */
  async withdraw(userId: string, dto: WithdrawDto) {
    const { rows: userRows } = await this.db.query(
      'SELECT phone_verified FROM users WHERE id = $1',
      [userId],
    );
    if (!userRows[0]?.phone_verified) {
      throw new ForbiddenException('Phone verification required before withdrawal');
    }

    const { rows: recentRows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM transactions
       WHERE user_id = $1 AND type = 'withdrawal' AND created_at > NOW() - INTERVAL '1 hour'`,
      [userId],
    );
    if (parseInt(recentRows[0].count, 10) >= WITHDRAWAL_VELOCITY_LIMIT) {
      throw new ForbiddenException('Withdrawal limit reached — account under review');
    }

    const { rows: walletRows } = await this.db.query(
      'SELECT id, balance_ghs, last_escrow_credit_at FROM wallets WHERE user_id = $1',
      [userId],
    );
    const wallet = walletRows[0];
    if (!wallet) throw new NotFoundException('Wallet not found');

    if (wallet.last_escrow_credit_at) {
      const hoursSinceCredit =
        (Date.now() - new Date(wallet.last_escrow_credit_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceCredit < ESCROW_HOLD_HOURS) {
        throw new ForbiddenException('Funds must be held for 48 hours before withdrawal');
      }
    }

    if (Number(wallet.balance_ghs) < dto.amount_ghs) {
      throw new BadRequestException('Insufficient balance');
    }

    return this.db.withTransaction(async (client) => {
      await client.query('UPDATE wallets SET balance_ghs = balance_ghs - $2 WHERE id = $1', [
        wallet.id,
        dto.amount_ghs,
      ]);
      const { rows } = await client.query(
        `INSERT INTO transactions (user_id, wallet_id, type, status, amount, currency, payment_method, description, metadata)
         VALUES ($1, $2, 'withdrawal', 'pending', $3, 'GHS', $4, 'Withdrawal request', $5) RETURNING *`,
        [
          userId,
          wallet.id,
          dto.amount_ghs,
          dto.method,
          JSON.stringify({ account_number: dto.account_number, account_name: dto.account_name }),
        ],
      );
      return toTransactionDto(rows[0]);
    });
  }

  async getWithdrawalStatus(id: string, userId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND type = 'withdrawal'`,
      [id, userId],
    );
    if (!rows[0]) throw new NotFoundException('Withdrawal not found');
    return toTransactionDto(rows[0]);
  }
}
