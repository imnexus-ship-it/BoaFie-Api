import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import jwtConfig from '../../config/jwt.config';
import appConfig from '../../config/app.config';
import oauthConfig from '../../config/oauth.config';
import { DatabaseService } from '../../database/database.service';
import { UsersRepository } from '../users/users.repository';
import { UserRow, toAuthUser } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const OAUTH_HANDOFF_TTL_MS = 60 * 1000;
const VALID_ROLES = ['client', 'artisan', 'freelancer'] as const;
type SignupRole = (typeof VALID_ROLES)[number];

interface AuthTokens {
  user: ReturnType<typeof toAuthUser>;
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  /**
   * Yahoo's flow is redirect-based (browser navigates through Yahoo and
   * back), so tokens can't be returned directly from an API call the way
   * Google's ID-token flow does. Instead the callback stashes the issued
   * tokens here under a short-lived, single-use code and redirects the
   * browser to the frontend with just that code — never the tokens
   * themselves — which the frontend immediately exchanges via
   * POST /auth/exchange. Single Render instance, so in-memory is fine.
   */
  private readonly oauthHandoffs = new Map<string, { tokens: AuthTokens; expiresAt: number }>();

  constructor(
    private readonly users: UsersRepository,
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
    @Inject(jwtConfig.KEY) private readonly config: ConfigType<typeof jwtConfig>,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
    @Inject(oauthConfig.KEY) private readonly oauth: ConfigType<typeof oauthConfig>,
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

    if (dto.date_of_birth && this.age(dto.date_of_birth) < 18) {
      throw new BadRequestException('You must be at least 18 years old to join BoaFie');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.insert({
      email: dto.email,
      password_hash: passwordHash,
      full_name: dto.full_name,
      role: dto.role,
      phone: dto.phone ?? null,
      country_of_residence: dto.country_of_residence ?? null,
      region: dto.region ?? null,
      city: dto.city ?? null,
      date_of_birth: dto.date_of_birth ?? null,
      gender: dto.gender ?? null,
      referral_code: dto.referral_code ?? null,
      preferred_contact_method: dto.preferred_contact_method ?? null,
      marketing_opt_in: dto.marketing_opt_in ?? false,
      terms_accepted_at: new Date(),
    });
    await this.db.query('INSERT INTO wallets (user_id) VALUES ($1)', [user.id]);
    await this.db.query('INSERT INTO verifications (user_id) VALUES ($1)', [user.id]);

    return this.issueTokens(user);
  }

  private age(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) years--;
    return years;
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

  /**
   * Always resolves the same way regardless of whether the email exists,
   * so this endpoint can't be used to enumerate registered accounts.
   */
  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email);
    if (user) {
      const raw = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(raw).digest('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await this.db.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt],
      );
      // Dev-only stub — no transactional email provider wired in this build.
      console.log(
        `[dev password-reset stub] Reset link for ${email}: ${this.app.frontendUrl}/reset-password?token=${raw}`,
      );
    }
    return { requested: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { rows } = await this.db.query<{
      id: string;
      user_id: string;
      used_at: string | null;
      expires_at: string;
    }>('SELECT id, user_id, used_at, expires_at FROM password_reset_tokens WHERE token_hash = $1', [
      tokenHash,
    ]);
    const stored = rows[0];
    if (!stored || stored.used_at || new Date(stored.expires_at).getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      stored.user_id,
    ]);
    await this.db.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [stored.id]);
    // A password reset should invalidate every existing session, same as
    // the reuse-detection path in refresh() above.
    await this.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [stored.user_id]);
    await this.notifications.notify(
      stored.user_id,
      'security',
      'Your password was changed',
      'If this wasn\'t you, contact support immediately — every other session has been signed out.',
    );

    return { reset: true };
  }

  /**
   * Shared by Google and Yahoo: find the account by provider id, fall back
   * to matching by email (linking the social login to an existing
   * password account), or create a new one. `role` only matters for a
   * brand-new signup — an existing account keeps whatever role it has.
   */
  private async findOrCreateOAuthUser(params: {
    idColumn: 'google_id' | 'yahoo_id';
    providerId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    emailVerified?: boolean;
    role?: string;
  }): Promise<UserRow> {
    const { idColumn, providerId, email, name, avatarUrl, emailVerified, role } = params;

    let user =
      idColumn === 'google_id'
        ? await this.users.findByGoogleId(providerId)
        : await this.users.findByYahooId(providerId);

    if (!user) {
      const existing = await this.users.findByEmail(email);
      if (existing) {
        user = (await this.users.updateById(existing.id, { [idColumn]: providerId })) ?? existing;
      } else {
        const signupRole: SignupRole = VALID_ROLES.includes(role as SignupRole) ? (role as SignupRole) : 'client';
        user = await this.users.insert({
          email,
          password_hash: null,
          [idColumn]: providerId,
          full_name: name ?? email.split('@')[0],
          role: signupRole,
          avatar_url: avatarUrl ?? null,
          email_verified: emailVerified ?? false,
        });
        await this.db.query('INSERT INTO wallets (user_id) VALUES ($1)', [user.id]);
        await this.db.query('INSERT INTO verifications (user_id) VALUES ($1)', [user.id]);
      }
    }

    if (user.status === 'banned') throw new UnauthorizedException('Account banned');
    if (user.status === 'suspended') throw new UnauthorizedException('Account suspended');
    await this.db.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);
    return user;
  }

  /**
   * Verifies the ID token Google's client-side library (web) or
   * expo-auth-session (mobile) hands back directly — no redirect needed.
   * `aud` on the token always equals whichever client id requested it, so
   * every platform's client id that's actually configured is accepted;
   * verifyIdToken throws if the token's audience matches none of them.
   */
  async loginWithGoogle(idToken: string, role?: string) {
    const audience = [this.oauth.googleClientId, this.oauth.googleIosClientId, this.oauth.googleAndroidClientId].filter(
      Boolean,
    );
    if (audience.length === 0) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    const client = new OAuth2Client();
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
    if (!payload?.email) throw new UnauthorizedException('Google account has no email');

    const user = await this.findOrCreateOAuthUser({
      idColumn: 'google_id',
      providerId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture,
      emailVerified: payload.email_verified,
      role,
    });
    return this.issueTokens(user);
  }

  /**
   * Yahoo has no client-side ID-token SDK — this builds the standard OAuth2
   * authorize-redirect URL. `state` round-trips through Yahoo unmodified,
   * so it's used to carry both the signup role and which platform started
   * the flow (web browser vs. the mobile app's in-app browser session) —
   * the callback needs the latter to know where to redirect back to.
   */
  getYahooAuthUrl(role?: string, platform?: string): string {
    if (!this.oauth.yahooClientId) {
      throw new BadRequestException('Yahoo sign-in is not configured');
    }
    const signupRole: SignupRole = VALID_ROLES.includes(role as SignupRole) ? (role as SignupRole) : 'client';
    const params = new URLSearchParams({
      client_id: this.oauth.yahooClientId,
      redirect_uri: this.oauth.yahooRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: `${signupRole}:${platform === 'app' ? 'app' : 'web'}`,
    });
    return `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`;
  }

  /** Splits the `role:platform` pair packed into `state` by getYahooAuthUrl back apart. */
  parseYahooState(state: string | undefined): { role?: string; platform: 'web' | 'app' } {
    const [role, platform] = (state ?? '').split(':');
    return { role, platform: platform === 'app' ? 'app' : 'web' };
  }

  /** Exchanges Yahoo's authorization code for tokens + profile, then stashes an internal handoff code. */
  async handleYahooCallback(code: string, role?: string): Promise<string> {
    const basicAuth = Buffer.from(`${this.oauth.yahooClientId}:${this.oauth.yahooClientSecret}`).toString('base64');
    const tokenRes = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.oauth.yahooRedirectUri,
      }),
    });
    if (!tokenRes.ok) throw new UnauthorizedException('Yahoo sign-in failed');
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const profileRes = await fetch('https://api.login.yahoo.com/openid/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileRes.ok) throw new UnauthorizedException('Could not fetch Yahoo profile');
    const profile = (await profileRes.json()) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };
    if (!profile.email) throw new UnauthorizedException('Yahoo account has no email');

    const user = await this.findOrCreateOAuthUser({
      idColumn: 'yahoo_id',
      providerId: profile.sub,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      emailVerified: profile.email_verified,
      role,
    });
    const tokens = await this.issueTokens(user);

    const handoffCode = randomBytes(24).toString('hex');
    this.oauthHandoffs.set(handoffCode, { tokens, expiresAt: Date.now() + OAUTH_HANDOFF_TTL_MS });
    return handoffCode;
  }

  exchangeHandoff(handoff: string): AuthTokens {
    const entry = this.oauthHandoffs.get(handoff);
    this.oauthHandoffs.delete(handoff); // single-use regardless of outcome
    if (!entry || entry.expiresAt < Date.now()) {
      throw new BadRequestException('Invalid or expired sign-in code');
    }
    return entry.tokens;
  }
}
