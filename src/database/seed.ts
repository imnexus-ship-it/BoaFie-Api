import 'dotenv/config';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const DEMO_PASSWORD = 'Password123';

async function upsertUser(
  pool: Pool,
  data: { email: string; full_name: string; role: string; phone: string },
) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, phone, phone_verified, email_verified, status)
     VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, 'active')
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id, email, role`,
    [data.email, passwordHash, data.full_name, data.role, data.phone],
  );
  const user = rows[0];
  await pool.query('INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [
    user.id,
  ]);
  await pool.query(
    'INSERT INTO verifications (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [user.id],
  );
  return user;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const client = await upsertUser(pool, {
    email: 'client@demo.boafie.test',
    full_name: 'Ama Client',
    role: 'client',
    phone: '+233200000001',
  });

  const artisan = await upsertUser(pool, {
    email: 'artisan@demo.boafie.test',
    full_name: 'Kwame Artisan',
    role: 'artisan',
    phone: '+233200000002',
  });

  const freelancer = await upsertUser(pool, {
    email: 'freelancer@demo.boafie.test',
    full_name: 'Efua Freelancer',
    role: 'freelancer',
    phone: '+233200000003',
  });

  const admin = await upsertUser(pool, {
    email: 'admin@demo.boafie.test',
    full_name: 'BoaFie Admin',
    role: 'admin',
    phone: '+233200000004',
  });

  await pool.query(
    `INSERT INTO artisan_profiles (user_id, trade_category, years_experience, hourly_rate_ghs, daily_rate_ghs, location_text, region, city)
     VALUES ($1, 'Carpentry', 6, 45, 300, 'East Legon, Accra', 'Greater Accra', 'Accra')
     ON CONFLICT (user_id) DO NOTHING`,
    [artisan.id],
  );

  await pool.query(
    `INSERT INTO freelancer_profiles (user_id, title, skills, hourly_rate_ghs, remote_only, location_text)
     VALUES ($1, 'Web Developer', ARRAY['web-development','graphic-design'], 80, TRUE, 'Accra, Ghana')
     ON CONFLICT (user_id) DO NOTHING`,
    [freelancer.id],
  );

  console.log('Seeded demo accounts (password for all: %s):', DEMO_PASSWORD);
  for (const u of [client, artisan, freelancer, admin]) {
    console.log(`  ${u.role.padEnd(11)} ${u.email}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
