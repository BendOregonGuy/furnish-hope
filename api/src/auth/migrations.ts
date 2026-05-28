/**
 * Idempotent schema migrations that run at startup. Add new migrations to
 * the array — they're applied in order, and each one is wrapped so it only
 * runs if the change isn't already present. Safe to run repeatedly.
 */

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { query, queryOne } from '../db/pool.js';

interface Migration {
  name: string;
  run: () => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    name: 'tbl_user_account.is_admin',
    async run() {
      await query(`
        ALTER TABLE tbl_user_account
          ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false
      `);
    },
  },
  {
    name: 'tbl_user_account.is_active default',
    async run() {
      // is_active is NOT NULL in the schema but had no default — make new
      // rows default to active so admin-creating-a-user doesn't blow up.
      await query(`ALTER TABLE tbl_user_account ALTER COLUMN is_active SET DEFAULT true`);
    },
  },
  {
    name: 'tbl_user_account.created_at default',
    async run() {
      await query(`ALTER TABLE tbl_user_account ALTER COLUMN created_at SET DEFAULT NOW()`);
    },
  },
  {
    name: 'tbl_audit_log.action_at default',
    async run() {
      await query(`ALTER TABLE tbl_audit_log ALTER COLUMN action_at SET DEFAULT NOW()`);
    },
  },
  {
    name: 'session table',
    async run() {
      // connect-pg-simple's canonical session table. Creating it ourselves so
      // we know it exists by the time express-session boots.
      await query(`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid"    VARCHAR NOT NULL PRIMARY KEY,
          "sess"   JSON NOT NULL,
          "expire" TIMESTAMP(6) NOT NULL
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
    },
  },
];

/** Run every migration, then ensure there's an initial admin user. */
export async function runAuthMigrations(): Promise<void> {
  for (const m of MIGRATIONS) {
    try {
      await m.run();
    } catch (err: any) {
      console.error(`Migration "${m.name}" failed:`, err.message);
      throw err;
    }
  }

  await ensureInitialAdmin();
}

/**
 * If there is no admin in the system, create one and print the temporary
 * password to the console. Runs on fresh installs (no users) AND on
 * existing installs that pre-date the is_admin column (the demo seed
 * data has no admins). The password is unique per-installation and the
 * admin must change it on first login.
 */
async function ensureInitialAdmin(): Promise<void> {
  const existing = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM tbl_user_account WHERE is_admin = true`,
  );
  if (Number(existing?.count ?? 0) > 0) return;

  // Pick a username that doesn't collide with existing demo users.
  const desiredName = await pickAvailableUsername('admin');
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 10);

  await query(`
    INSERT INTO tbl_user_account (username, password_hash, is_active, is_admin)
    VALUES ($1, $2, true, true)
  `, [desiredName, hash]);

  const banner = '*'.repeat(72);
  console.log('\n' + banner);
  console.log('INITIAL ADMIN ACCOUNT CREATED');
  console.log(`  Username: ${desiredName}`);
  console.log(`  Temporary password: ${tempPassword}`);
  console.log('  CHANGE THIS PASSWORD on first login.');
  console.log(banner + '\n');
}

/** Return the requested username if it's free, otherwise append a number. */
async function pickAvailableUsername(base: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const taken = await queryOne<{ id: number }>(
      `SELECT user_account_id AS id FROM tbl_user_account WHERE username = $1`,
      [candidate],
    );
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** A readable temp password — three short syllables + 3 digits. Easy to
 *  type from a console but still high-entropy enough to not be guessed. */
function generateTempPassword(): string {
  const syllables = ['cas', 'mor', 'len', 'tor', 'pin', 'val', 'sun', 'ash', 'jun', 'rey', 'tan', 'oak', 'mes', 'fal', 'win', 'kel'];
  const pick = () => syllables[crypto.randomInt(0, syllables.length)];
  const digits = crypto.randomInt(100, 999);
  return `${pick()}-${pick()}-${pick()}-${digits}`;
}
