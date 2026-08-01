import { registerAs } from '@nestjs/config';

export default registerAs('oauth', () => ({
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  yahooClientId: process.env.YAHOO_CLIENT_ID ?? '',
  yahooClientSecret: process.env.YAHOO_CLIENT_SECRET ?? '',
  yahooRedirectUri: process.env.YAHOO_REDIRECT_URI ?? 'http://localhost:3001/v1/auth/yahoo/callback',
}));
