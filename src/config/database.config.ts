import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/boafie',
}));
