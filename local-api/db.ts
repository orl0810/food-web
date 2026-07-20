import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { allBaseRecipeSeeds } from '../supabase/seeds/base-recipes/index.ts';
import type { BaseRecipeSeed } from '../supabase/seeds/base-recipes/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data', 'pantryflow.sqlite');
const foodWasteCollectionPath = join(
  __dirname,
  '..',
  'src',
  'assets',
  'base_recipes_food_waste_collection.json'
);

interface LocalBaseRecipeSeed extends BaseRecipeSeed {
  nutrition_calories?: number | null;
  nutrition_fat_g?: number | null;
  nutrition_cholesterol_mg?: number | null;
  nutrition_protein_g?: number | null;
  nutrition_sugar_g?: number | null;
  nutrition_sodium_mg?: number | null;
  nutrition_carbs_g?: number | null;
  nutrition_fiber_g?: number | null;
}

interface FoodWasteCollection {
  recipes: Array<{
    recipe: Omit<LocalBaseRecipeSeed, 'ingredients'>;
    ingredients: LocalBaseRecipeSeed['ingredients'];
  }>;
}

const foodWasteCollection = JSON.parse(
  readFileSync(foodWasteCollectionPath, 'utf8')
) as FoodWasteCollection;
const localBaseRecipeSeeds: LocalBaseRecipeSeed[] = [
  ...allBaseRecipeSeeds,
  ...foodWasteCollection.recipes.map(({ recipe, ingredients }) => ({ ...recipe, ingredients })),
];

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

if (tableExists('meal_plan_items') && !tableHasColumn('meal_plan_items', 'source')) {
  db.exec(
    "alter table meal_plan_items add column source text check (source is null or source in ('manual', 'voice', 'photo'))"
  );
}

if (tableExists('meal_plan_items') && !tableHasColumn('meal_plan_items', 'image_url')) {
  db.exec('alter table meal_plan_items add column image_url text');
}

if (tableExists('meal_plan_items') && !tableHasColumn('meal_plan_items', 'transcript')) {
  db.exec('alter table meal_plan_items add column transcript text');
}

if (tableExists('recipes') && !tableHasColumn('recipes', 'rating')) {
  db.exec('alter table recipes add column rating integer check (rating is null or (rating >= 1 and rating <= 5))');
}

if (tableExists('recipes') && !tableHasColumn('recipes', 'image_url')) {
  db.exec('alter table recipes add column image_url text');
}

if (tableExists('recipes') && !tableHasColumn('recipes', 'image_status')) {
  db.exec(`
    alter table recipes add column image_status text not null default 'pending'
      check (image_status in ('pending', 'generating', 'completed', 'failed'));
    alter table recipes add column image_prompt text;
    alter table recipes add column image_provider text;
    alter table recipes add column image_version integer not null default 1;
    alter table recipes add column image_generated_at text;
    alter table recipes add column image_error text;
    alter table recipes add column image_storage_provider text default 'cloudflare_r2';
    alter table recipes add column image_storage_key text;
  `);
  db.exec(`
    update recipes
    set image_status = 'completed'
    where image_url is not null and trim(image_url) <> '';
  `);
}

if (tableExists('recipes') && !tableHasColumn('recipes', 'nutrition_calories')) {
  db.exec(`
    alter table recipes add column nutrition_calories real;
    alter table recipes add column nutrition_fat_g real;
    alter table recipes add column nutrition_cholesterol_mg real;
    alter table recipes add column nutrition_protein_g real;
    alter table recipes add column nutrition_sugar_g real;
    alter table recipes add column nutrition_sodium_mg real;
    alter table recipes add column nutrition_carbs_g real;
    alter table recipes add column nutrition_fiber_g real;
    alter table recipes add column nutrition_calculated_at text;
  `);
}

if (tableExists('recipes') && !tableHasColumn('recipes', 'is_base_recipe')) {
  db.exec(`
    alter table recipes add column is_base_recipe integer not null default 0 check (is_base_recipe in (0, 1));
    alter table recipes add column base_recipe_id text references recipes (id) on delete set null;
    alter table recipes add column meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));
    alter table recipes add column category text;
    alter table recipes add column difficulty text check (difficulty in ('easy', 'medium', 'hard'));
    alter table recipes add column cook_time_minutes integer;
    alter table recipes add column instructions text not null default '[]';
    alter table recipes add column updated_at text;
    update recipes set updated_at = coalesce(created_at, datetime('now')) where updated_at is null;
  `);
}

if (tableExists('recipes')) {
  const userIdColumn = (
    db.prepare('pragma table_info(recipes)').all() as { name: string; notnull: number }[]
  ).find((column) => column.name === 'user_id');

  if (userIdColumn?.notnull === 1) {
    db.exec(`
      pragma foreign_keys = off;
      drop table if exists recipes_migrated;
      create table recipes_migrated (
        id text primary key,
        user_id text references users (id) on delete cascade,
        title text not null,
        description text,
        prep_time_minutes integer,
        cook_time_minutes integer,
        portions integer,
        tags text not null default '[]',
        rating integer check (rating is null or (rating >= 1 and rating <= 5)),
        image_url text,
        is_base_recipe integer not null default 0 check (is_base_recipe in (0, 1)),
        base_recipe_id text references recipes_migrated (id) on delete set null,
        meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
        category text,
        difficulty text check (difficulty in ('easy', 'medium', 'hard')),
        instructions text not null default '[]',
        nutrition_calories real,
        nutrition_fat_g real,
        nutrition_cholesterol_mg real,
        nutrition_protein_g real,
        nutrition_sugar_g real,
        nutrition_sodium_mg real,
        nutrition_carbs_g real,
        nutrition_fiber_g real,
        nutrition_calculated_at text,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now')),
        check (
          (is_base_recipe = 1 and user_id is null)
          or (is_base_recipe = 0 and user_id is not null)
        )
      );
      insert into recipes_migrated (
        id, user_id, title, description, prep_time_minutes, cook_time_minutes, portions, tags,
        rating, image_url, is_base_recipe, base_recipe_id, meal_type, category, difficulty,
        instructions, nutrition_calories, nutrition_fat_g, nutrition_cholesterol_mg,
        nutrition_protein_g, nutrition_sugar_g, nutrition_sodium_mg, nutrition_carbs_g,
        nutrition_fiber_g, nutrition_calculated_at, created_at, updated_at
      )
      select
        id, user_id, title, description, prep_time_minutes, cook_time_minutes, portions, tags,
        rating, image_url,
        coalesce(is_base_recipe, 0), base_recipe_id, meal_type, category, difficulty,
        coalesce(instructions, '[]'),
        nutrition_calories, nutrition_fat_g, nutrition_cholesterol_mg,
        nutrition_protein_g, nutrition_sugar_g, nutrition_sodium_mg, nutrition_carbs_g,
        nutrition_fiber_g, nutrition_calculated_at, created_at,
        coalesce(created_at, datetime('now'))
      from recipes;
      drop table recipes;
      alter table recipes_migrated rename to recipes;
      create index if not exists recipes_user_id_idx on recipes (user_id);
      create index if not exists recipes_is_base_recipe_idx on recipes (is_base_recipe);
      create index if not exists recipes_meal_type_idx on recipes (meal_type);
      create index if not exists recipes_category_idx on recipes (category);
      create index if not exists recipes_base_recipe_id_idx on recipes (base_recipe_id);
      pragma foreign_keys = on;
    `);
  }
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

if (tableExists('user_food_profiles') && !tableHasColumn('user_food_profiles', 'weight_kg')) {
  db.exec(`
    alter table user_food_profiles add column weight_kg real;
    alter table user_food_profiles add column height_cm real;
    alter table user_food_profiles add column age integer check (age is null or (age between 13 and 120));
    alter table user_food_profiles add column sex text check (sex is null or sex in ('male', 'female'));
    alter table user_food_profiles add column activity_level text check (
      activity_level is null or activity_level in (
        'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'
      )
    );
    alter table user_food_profiles add column nutrition_goal text check (
      nutrition_goal is null or nutrition_goal in (
        'maintain', 'fat_loss', 'muscle_gain', 'general_health'
      )
    );
  `);
}

if (tableExists('user_food_profiles') && !tableHasColumn('user_food_profiles', 'role')) {
  db.exec(`
    alter table user_food_profiles add column role text not null default 'user' check (role in ('user', 'admin'));
  `);
}

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const iconMigration = readFileSync(join(__dirname, 'migrate-icons.sql'), 'utf8');
db.exec(iconMigration);

function seedBaseRecipesIfNeeded(): void {
  if (!tableExists('recipes')) {
    return;
  }

  const baseCount = db
    .prepare('select count(*) as count from recipes where is_base_recipe = 1')
    .get() as { count: number };

  if (baseCount.count >= localBaseRecipeSeeds.length) {
    return;
  }

  const insertRecipe = db.prepare(`
    insert or ignore into recipes (
      id, user_id, title, description, prep_time_minutes, cook_time_minutes, portions, tags,
      image_url, image_status, image_prompt, image_storage_provider, image_storage_key,
      is_base_recipe, meal_type, category, difficulty, instructions,
      nutrition_calories, nutrition_fat_g, nutrition_cholesterol_mg, nutrition_protein_g,
      nutrition_sugar_g, nutrition_sodium_mg, nutrition_carbs_g, nutrition_fiber_g
    ) values (?, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertIngredient = db.prepare(`
    insert or ignore into recipe_ingredients (id, recipe_id, name, quantity, unit)
    values (?, ?, ?, ?, ?)
  `);

  const seedAll = db.transaction(() => {
    for (const recipe of localBaseRecipeSeeds) {
      insertRecipe.run(
        recipe.id,
        recipe.title,
        recipe.description,
        recipe.prep_time_minutes,
        recipe.cook_time_minutes,
        recipe.portions,
        JSON.stringify(recipe.tags),
        recipe.image_url ?? null,
        recipe.image_status ?? 'pending',
        recipe.image_prompt ?? null,
        recipe.image_storage_provider ?? 'cloudflare_r2',
        recipe.image_storage_key ?? null,
        recipe.meal_type,
        recipe.category,
        recipe.difficulty,
        JSON.stringify(recipe.instructions),
        recipe.nutrition_calories ?? null,
        recipe.nutrition_fat_g ?? null,
        recipe.nutrition_cholesterol_mg ?? null,
        recipe.nutrition_protein_g ?? null,
        recipe.nutrition_sugar_g ?? null,
        recipe.nutrition_sodium_mg ?? null,
        recipe.nutrition_carbs_g ?? null,
        recipe.nutrition_fiber_g ?? null
      );

      recipe.ingredients.forEach((ingredient) => {
        if (!ingredient.id) {
          throw new Error(`Missing ingredient id for ${recipe.title}`);
        }
        insertIngredient.run(
          ingredient.id,
          recipe.id,
          ingredient.name,
          ingredient.quantity ?? null,
          ingredient.unit ?? null
        );
      });
    }
  });

  seedAll();
}

seedBaseRecipesIfNeeded();

const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';

const userCount = db.prepare('select count(*) as count from users').get() as { count: number };
if (userCount.count === 0) {
  const passwordHash = bcrypt.hashSync('password', 10);
  db.prepare(
    'insert into users (id, email, password_hash) values (?, ?, ?)'
  ).run(DEV_USER_ID, 'dev@local.test', passwordHash);
}

const devProfile = db
  .prepare('select id from user_food_profiles where user_id = ?')
  .get(DEV_USER_ID) as { id: string } | undefined;
if (devProfile) {
  db.prepare("update user_food_profiles set role = 'admin' where user_id = ?").run(DEV_USER_ID);
}

export { db };
