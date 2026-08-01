import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import jwtConfig from '../../config/jwt.config';
import { DatabaseService } from '../../database/database.service';
import { UsersRepository } from '../users/users.repository';
import { UserRow, toAuthUser } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  private signAccessToken(user: Pick<UserRow, 'id' | 'role'>) {
    return this.jwt.sign(
      { sub: user.id, role: user.role },
      { secret: this.config.accessSecret, expiresIn: this.config.accessExpiresIn },
    );
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(40).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + this.config.refreshExpiresInMs);
    await this.db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt],
    );
    return raw;
  }

  private async issueTokens(user: UserRow) {
    return {
      user: toAuthUser(user),
      access_token: this.signAccessToken(user),
      refresh_token: await this.issueRefreshToken(user.id),
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    if (dto.phone) {
      const existingPhone = await this.users.findByPhone(dto.phone);
      if (existingPhone) throw new ConflictException('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.insert({
      email: dto.email,
      password_hash: passwordHash,
      full_name: dto.full_name,
      role: dto.role,
      phone: dto.phone ?? null,
    });
    await this.db.query('INSERT INTO wallets (user_id) VALUES ($1)', [user.id]);
    await this.db.query('INSERT INTO verifications (user_id) VALUES ($1)', [user.id]);

    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');
    if (user.status === 'banned') throw new UnauthorizedException('Account banned');
    if (user.status === 'suspended') throw new UnauthorizedException('Account suspended');

    await this.db.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);
    return this.issueTokens(user);
  }

  /**
   * Single-use refresh tokens with reuse detection, matching the security
   * doc exactly: a token reused after being consumed indicates theft, so
   * every session for that user is invalidated rather than just this one.
   */
  async refresh(refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const { rows } = await this.db.query<{
      id: string;
      user_id: string;
      used_at: string | null;
      expires_at: string;
    }>('SELECT id, user_id, used_at, expires_at FROM refresh_tokens WHERE token_hash = $1', [
      tokenHash,
    ]);
    const stored = rows[0];
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.used_at) {
      await this.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [stored.user_id]);
      throw new UnauthorizedException('Token reuse detected — all sessions invalidated');
    }
    if (new Date(stored.expires_at).getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.db.query('UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1', [stored.id]);

    const user = await this.users.findById(stored.user_id);
    if (!user) throw new UnauthorizedException('User not found');
    if (user.status === 'banned' || user.status === 'suspended') {
      throw new UnauthorizedException('Account no longer active');
    }
    return this.issueTokens(user);
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  }
}
