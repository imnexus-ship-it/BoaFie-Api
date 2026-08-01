import { config } from 'dotenv';
import { resolve } from 'path';

// Runs before each e2e test file's module graph loads, so DATABASE_URL
// (and everything else) is set before AppModule's ConfigModule.forRoot()
// reads process.env.
config({ path: resolve(__dirname, '../../.env.test') });
