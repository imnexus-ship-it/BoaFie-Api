import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersRepository } from '../users/users.repository';
import { DatabaseService } from '../../database/database.service';

const verifyIdTokenMock = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: verifyIdTokenMock,
  })),
}));

function buildService(overrides: { users?: Partial<UsersRepository>; db?: Partial<DatabaseService> } = {}) {
  const users = {
    findByGoogleId: jest.fn().mockResolvedValue(null),
    findByYahooId: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    insert: jest.fn(),
    updateById: jest.fn(),
    ...overrides.users,
  } as unknown as UsersRepository;

  const db = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    ...overrides.db,
  } as unknown as DatabaseService;

  const jwt = { sign: jest.fn().mockReturnValue('signed-access-token') } as any;
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) } as any;
  const jwtConfigValue = {
    accessSecret: 'secret',
    accessExpiresIn: '15m',
    refreshSecret: 'refresh-secret',
    refreshExpiresIn: '7d',
    refreshExpiresInMs: 1000 * 60,
  };
  const appConfigValue = { nodeEnv: 'test', port: 3001, corsOrigin: 'http://localhost:3000', frontendUrl: 'http://localhost:3000' };
  const oauthConfigValue = {
    googleClientId: 'test-google-client-id',
    yahooClientId: 'test-yahoo-client-id',
    yahooClientSecret: 'test-yahoo-secret',
    yahooRedirectUri: 'http://localhost:3001/v1/auth/yahoo/callback',
  };

  const service = new AuthService(users, db, jwt, notifications, jwtConfigValue as any, appConfigValue as any, oauthConfigValue as any);
  return { service, users, db };
}

describe('AuthService — Google sign-in', () => {
  beforeEach(() => verifyIdTokenMock.mockReset());

  it('creates a new user on first Google sign-in, with the given role', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: 'g-123', email: 'new@gmail.com', name: 'New Person', picture: 'http://pic', email_verified: true }),
    });
    const { service, users } = buildService({
      users: {
        insert: jest.fn().mockResolvedValue({ id: 'u1', status: 'active', role: 'artisan' }),
      },
    });

    const result = await service.loginWithGoogle('a-valid-id-token', 'artisan');

    expect(users.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@gmail.com', google_id: 'g-123', role: 'artisan', password_hash: null }),
    );
    expect(result.access_token).toBe('signed-access-token');
  });

  it('logs in an existing user matched by google_id, ignoring any role passed', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: 'g-456', email: 'existing@gmail.com' }),
    });
    const { service, users } = buildService({
      users: {
        findByGoogleId: jest.fn().mockResolvedValue({ id: 'u2', status: 'active', role: 'client' }),
      },
    });

    await service.loginWithGoogle('token', 'artisan');
    expect(users.insert).not.toHaveBeenCalled();
  });

  it('links Google to an existing password account matched by email', async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: 'g-789', email: 'already@gmail.com' }),
    });
    const { service, users } = buildService({
      users: {
        findByEmail: jest.fn().mockResolvedValue({ id: 'u3', status: 'active', role: 'client' }),
        updateById: jest.fn().mockResolvedValue({ id: 'u3', status: 'active', role: 'client', google_id: 'g-789' }),
      },
    });

    await service.loginWithGoogle('token');
    expect(users.updateById).toHaveBeenCalledWith('u3', { google_id: 'g-789' });
    expect(users.insert).not.toHaveBeenCalled();
  });

  it('rejects a banned account', async () => {
    verifyIdTokenMock.mockResolvedValue({ getPayload: () => ({ sub: 'g-1', email: 'banned@gmail.com' }) });
    const { service } = buildService({
      users: { findByGoogleId: jest.fn().mockResolvedValue({ id: 'u4', status: 'banned' }) },
    });
    await expect(service.loginWithGoogle('token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token that fails verification', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('bad signature'));
    const { service } = buildService();
    await expect(service.loginWithGoogle('garbage')).rejects.toThrow(UnauthorizedException);
  });
});

describe('AuthService — Yahoo sign-in', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('builds an authorize URL with the client id and role as state', () => {
    const { service } = buildService();
    const url = service.getYahooAuthUrl('freelancer');
    expect(url).toContain('https://api.login.yahoo.com/oauth2/request_auth');
    expect(url).toContain('client_id=test-yahoo-client-id');
    expect(url).toContain('state=freelancer');
  });

  it('exchanges a code for tokens and issues a single-use handoff code', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'yahoo-access-token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'y-1', email: 'worker@yahoo.com', name: 'Yahoo Worker' }),
      }) as any;

    const { service, users } = buildService({
      users: { insert: jest.fn().mockResolvedValue({ id: 'u5', status: 'active', role: 'freelancer' }) },
    });

    const handoff = await service.handleYahooCallback('auth-code', 'freelancer');
    expect(typeof handoff).toBe('string');
    expect(users.insert).toHaveBeenCalledWith(expect.objectContaining({ email: 'worker@yahoo.com', yahoo_id: 'y-1' }));

    const tokens = service.exchangeHandoff(handoff);
    expect(tokens.access_token).toBe('signed-access-token');

    // single-use
    expect(() => service.exchangeHandoff(handoff)).toThrow(BadRequestException);
  });

  it('rejects an unknown handoff code', () => {
    const { service } = buildService();
    expect(() => service.exchangeHandoff('never-issued')).toThrow(BadRequestException);
  });

  it('throws if Yahoo rejects the token exchange', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false }) as any;
    const { service } = buildService();
    await expect(service.handleYahooCallback('bad-code')).rejects.toThrow(UnauthorizedException);
  });
});
