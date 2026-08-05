import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  frontendUrl: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0],
  // Where the Yahoo OAuth callback sends a mobile-initiated sign-in once
  // it's done — the app's registered URL scheme (see boafie-mobile's
  // app.json `expo.scheme`), not a web origin. expo-web-browser's
  // AuthSession intercepts this redirect itself; no server-side allowlist
  // needed since it's a single fixed value, not client-supplied.
  mobileAuthCallbackUrl: process.env.MOBILE_AUTH_CALLBACK_URL ?? 'boafie://auth/callback',
  openaiApiKey: process.env.OPENAI_API_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'BoaFie <onboarding@resend.dev>',
  contactEmail: process.env.CONTACT_EMAIL ?? 'info.boafietechltd@gmail.com',
  hubtelClientId: process.env.HUBTEL_CLIENT_ID,
  hubtelClientSecret: process.env.HUBTEL_CLIENT_SECRET,
  hubtelSenderId: process.env.HUBTEL_SENDER_ID ?? 'BoaFie',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
}));
