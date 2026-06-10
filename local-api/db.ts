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

function tableHasColumn(table: string, column: string): boolean {
  const columns = db.prepare(`pragma table_info(${table})`).all() as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

function tableExists(table: string): boolean {
  const row = db
    .prepare("select name from sqlite_master where type = 'table' and name = ?")
    .get(table) as { name: string } | undefined;
  return !!row;
}

// Add icon columns before schema inserts reference them on existing databases.
if (tableExists('food_categories') && !tableHasColumn('food_categories', 'icon')) {
  db.exec("alter table food_categories add column icon text not null default '🍽️'");
}

if (tableExists('food_catalog_items') && !tableHasColumn('food_catalog_items', 'icon')) {
  db.exec("alter table food_catalog_items add column icon text not null default '🍽️'");
}

// Migrate legacy meal_plan → meal_plan_items
if (tableExists('meal_plan') && !tableExists('meal_plan_items')) {
  db.exec(`
    create table meal_plan_items (
      id text primary key,
      user_id text not null references users (id) on delete cascade,
      date text not null,
      meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
      item_type text not null check (item_type in ('recipe', 'prepared_portion', 'inventory_item', 'custom')),
      recipe_id text references recipes (id) on delete set null,
      prepared_portion_id text,
      inventory_item_id text references food_items (id) on delete set null,
      custom_name text,
      quantity real,
      unit text,
      portions_used integer not null default 1 check (portions_used > 0),
      notes text,
      sort_order integer not null default 0,
      created_at text not null default (datetime('now'))
    );
    insert into meal_plan_items (id, user_id, date, meal_type, item_type, recipe_id, created_at)
    select id, user_id, date, meal_type, 'recipe', recipe_id, created_at
    from meal_plan
    where recipe_id is not null;
    drop table meal_plan;
  `);
}

// Add meal plan item status columns on existing databases.
if (tableExists('meal_plan_items') && !tableHasColumn('meal_plan_items', 'status')) {
  db.exec(
    "alter table meal_plan_items add column status text not null default 'planned' check (status in ('planned', 'prepared', 'eaten', 'skipped'))"
  );
}

if (tableExists('meal_plan_items') && !tableHasColumn('meal_plan_items', 'completed_at')) {
  db.exec('alter table meal_plan_items add column completed_at text');
}

if (tableExists('user_food_profiles') && !tableHasColumn('user_food_profiles', 'onboarding_status')) {
  db.exec(`
    alter table user_food_profiles add column onboarding_status text not null default 'pending';
    alter table user_food_profiles add column onboarding_current_step text;
    alter table user_food_profiles add column onboarding_goals text not null default '[]';
    alter table user_food_profiles add column onboarding_cooking_effort text;
    alter table user_food_profiles add column onboarding_planning_days integer;
    alter table user_food_profiles add column onboarding_draft_state text;
    alter table user_food_profiles add column onboarding_first_smart_action text;
    alter table user_food_profiles add column onboarding_completed_at text;
  `);
}

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const iconMigration = readFileSync(join(__dirname, 'migrate-icons.sql'), 'utf8');
db.exec(iconMigration);

const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';

const userCount = db.prepare('select count(*) as count from users').get() as { count: number };
if (userCount.count === 0) {
  const passwordHash = bcrypt.hashSync('password', 10);
  db.prepare(
    'insert into users (id, email, password_hash) values (?, ?, ?)'
  ).run(DEV_USER_ID, 'dev@local.test', passwordHash);
}

export { db };
