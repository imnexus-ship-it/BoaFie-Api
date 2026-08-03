import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  frontendUrl: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0],
  openaiApiKey: process.env.OPENAI_API_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'BoaFie <onboarding@resend.dev>',
  hubtelClientId: process.env.HUBTEL_CLIENT_ID,
  hubtelClientSecret: process.env.HUBTEL_CLIENT_SECRET,
  hubtelSenderId: process.env.HUBTEL_SENDER_ID ?? 'BoaFie',
}));
