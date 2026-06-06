import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data', 'pantryflow.sqlite');

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';

const userCount = db.prepare('select count(*) as count from users').get() as { count: number };
if (userCount.count === 0) {
  const passwordHash = bcrypt.hashSync('password', 10);
  db.prepare(
    'insert into users (id, email, password_hash) values (?, ?, ?)'
  ).run(DEV_USER_ID, 'dev@local.test', passwordHash);
}

export { db };
