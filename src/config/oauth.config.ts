import { registerAs } from '@nestjs/config';

export default registerAs('oauth', () => ({
  // Google issues a separate OAuth client per platform (Web, iOS, Android),
  // and an id_token's `aud` claim always equals whichever client id
  // requested it. The web app only ever uses the Web client, but the
  // mobile app authenticates natively with the iOS/Android client — so
  // verification has to accept any of them as a valid audience. All three
  // are optional; only the ones actually provisioned end up in the list.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? '',
  googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? '',
  yahooClientId: process.env.YAHOO_CLIENT_ID ?? '',
  yahooClientSecret: process.env.YAHOO_CLIENT_SECRET ?? '',
  yahooRedirectUri: process.env.YAHOO_REDIRECT_URI ?? 'http://localhost:3001/v1/auth/yahoo/callback',
}));
