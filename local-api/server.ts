import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { signToken, verifyToken } from './auth.js';

const PORT = Number(process.env['LOCAL_API_PORT'] ?? 3001);

interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

interface FoodItemHistoryPayload {
  name: string;
  category: string | null;
  unit: string | null;
  location: string;
  default_quantity: number;
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function formatInventoryName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
}

function upsertFoodItemHistory(userId: string, payload: FoodItemHistoryPayload): void {
  const name = payload.name.trim();
  const nameKey = normalizeNameKey(name);

  if (!name) {
    return;
  }

  const existing = db
    .prepare('select id from food_item_history where user_id = ? and name_key = ?')
    .get(userId, nameKey) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `update food_item_history
       set name = ?, category = ?, unit = ?, location = ?, default_quantity = ?, last_used_at = datetime('now'), times_added = times_added + 1
       where id = ? and user_id = ?`
    ).run(
      name,
      payload.category,
      payload.unit,
      payload.location,
      payload.default_quantity,
      existing.id,
      userId
    );
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `insert into food_item_history (
       id, user_id, name, name_key, category, unit, location, default_quantity, times_added
     ) values (?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(
    id,
    userId,
    name,
    nameKey,
    payload.category,
    payload.unit,
    payload.location,
    payload.default_quantity
  );
}

interface RecipeRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  prep_time_minutes: number | null;
  portions: number | null;
  tags: string;
  created_at: string;
}

function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isNaN(num) ? null : Math.trunc(num);
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const tags = new Set<string>();
  for (const tag of value) {
    const normalized = String(tag).trim().toLowerCase();
    if (normalized) {
      tags.add(normalized);
    }
  }
  return [...tags];
}

function serializeRecipe(row: RecipeRow) {
  const ingredients = db
    .prepare(
      `select id, recipe_id, name, quantity, unit
       from recipe_ingredients
       where recipe_id = ?
       order by name asc`
    )
    .all(row.id);

  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags ?? '[]');
    tags = Array.isArray(parsed) ? parsed : [];
  } catch {
    tags = [];
  }

  return { ...row, tags, ingredients };
}

function getRecipeRow(id: string, userId: string): RecipeRow | undefined {
  return db
    .prepare(
      `select id, user_id, title, description, prep_time_minutes, portions, tags, created_at
       from recipes
       where id = ? and user_id = ?`
    )
    .get(id, userId) as RecipeRow | undefined;
}

interface MealPlanItemRow {
  id: string;
  user_id: string;
  date: string;
  meal_type: string;
  item_type: string;
  recipe_id: string | null;
  prepared_portion_id: string | null;
  inventory_item_id: string | null;
  custom_name: string | null;
  quantity: number | null;
  unit: string | null;
  portions_used: number;
  notes: string | null;
  sort_order: number;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface PreparedPortionRow {
  id: string;
  user_id: string;
  name: string;
  source_type: string;
  recipe_id: string | null;
  total_portions: number;
  available_portions: number;
  cooked_at: string;
  expires_at: string | null;
  storage_location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function getFoodItemRow(id: string, userId: string) {
  return db
    .prepare(
      `select id, name, quantity, unit, location
       from food_items
       where id = ? and user_id = ?`
    )
    .get(id, userId) as
    | { id: string; name: string; quantity: number; unit: string | null; location: string }
    | undefined;
}

function getPreparedPortionRow(id: string, userId: string): PreparedPortionRow | undefined {
  return db
    .prepare(
      `select id, user_id, name, source_type, recipe_id, total_portions, available_portions,
              cooked_at, expires_at, storage_location, notes, status, created_at, updated_at
       from prepared_portions
       where id = ? and user_id = ?`
    )
    .get(id, userId) as PreparedPortionRow | undefined;
}

function serializePreparedPortion(row: PreparedPortionRow) {
  const recipe = row.recipe_id
    ? serializeRecipeSummary(getRecipeRow(row.recipe_id, row.user_id))
    : null;

  return {
    ...row,
    recipe: recipe ? { id: recipe.id, title: recipe.title } : undefined,
  };
}

function serializeMealPlanItem(row: MealPlanItemRow) {
  const recipe = row.recipe_id
    ? serializeRecipeSummary(getRecipeRow(row.recipe_id, row.user_id))
    : null;
  const preparedPortion = row.prepared_portion_id
    ? getPreparedPortionRow(row.prepared_portion_id, row.user_id)
    : undefined;
  const inventoryItem = row.inventory_item_id
    ? getFoodItemRow(row.inventory_item_id, row.user_id)
    : undefined;

  return {
    ...row,
    recipe: recipe ?? undefined,
    prepared_portion: preparedPortion
      ? {
          id: preparedPortion.id,
          name: preparedPortion.name,
          available_portions: preparedPortion.available_portions,
          expires_at: preparedPortion.expires_at,
          storage_location: preparedPortion.storage_location,
        }
      : undefined,
    inventory_item: inventoryItem ?? undefined,
  };
}

function getMealPlanItemRow(id: string, userId: string): MealPlanItemRow | undefined {
  return db
    .prepare(
      `select id, user_id, date, meal_type, item_type, recipe_id, prepared_portion_id,
              inventory_item_id, custom_name, quantity, unit, portions_used, notes, sort_order,
              status, completed_at, created_at
       from meal_plan_items
       where id = ? and user_id = ?`
    )
    .get(id, userId) as MealPlanItemRow | undefined;
}

const VALID_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const VALID_ITEM_TYPES = new Set(['recipe', 'prepared_portion', 'inventory_item', 'custom']);

function serializeRecipeSummary(row: RecipeRow | undefined) {
  if (!row) {
    return null;
  }

  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags ?? '[]');
    tags = Array.isArray(parsed) ? parsed : [];
  } catch {
    tags = [];
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags,
    prep_time_minutes: row.prep_time_minutes,
  };
}

function replaceRecipeIngredients(recipeId: string, ingredients: unknown): void {
  db.prepare('delete from recipe_ingredients where recipe_id = ?').run(recipeId);

  if (!Array.isArray(ingredients)) {
    return;
  }

  const insert = db.prepare(
    'insert into recipe_ingredients (id, recipe_id, name, quantity, unit) values (?, ?, ?, ?, ?)'
  );

  for (const ingredient of ingredients) {
    const name = String(ingredient?.name ?? '').trim();
    if (!name) {
      continue;
    }
    const quantity = toNumberOrNull(ingredient?.quantity);
    const unit = ingredient?.unit?.trim?.() || null;
    insert.run(crypto.randomUUID(), recipeId, name, quantity, unit);
  }
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header.' });
    return;
  }

  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  req.userId = payload.sub;
  req.userEmail = payload.email;
  next();
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', database: 'sqlite' });
});

app.post('/auth/sign-up', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const existing = db.prepare('select id from users where email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('insert into users (id, email, password_hash) values (?, ?, ?)').run(
    id,
    email,
    passwordHash
  );

  const access_token = signToken(id, email);
  res.status(201).json({
    user: { id, email },
    access_token,
  });
});

app.post('/auth/sign-in', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const user = db
    .prepare('select id, email, password_hash from users where email = ?')
    .get(email) as { id: string; email: string; password_hash: string } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const access_token = signToken(user.id, user.email);
  res.json({
    user: { id: user.id, email: user.email },
    access_token,
  });
});

app.get('/auth/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json({
    user: { id: req.userId, email: req.userEmail },
  });
});

app.get('/food-items', authMiddleware, (req: AuthenticatedRequest, res) => {
  const items = db
    .prepare(
      `select id, user_id, name, category, quantity, unit, expiration_date, location, created_at
       from food_items
       where user_id = ?
       order by expiration_date asc nulls last, name asc`
    )
    .all(req.userId);
  res.json({ data: items });
});

app.get('/food-item-history', authMiddleware, (req: AuthenticatedRequest, res) => {
  const limit = Number.parseInt(String(req.query.limit ?? ''), 10);
  const offset = Number.parseInt(String(req.query.offset ?? ''), 10);
  const hasPagination =
    Number.isFinite(limit) && limit > 0 && Number.isFinite(offset) && offset >= 0;

  const sql = hasPagination
    ? `select id, user_id, name, category, unit, location, default_quantity, last_used_at, created_at, times_added
       from food_item_history
       where user_id = ?
       order by last_used_at desc, name asc
       limit ? offset ?`
    : `select id, user_id, name, category, unit, location, default_quantity, last_used_at, created_at, times_added
       from food_item_history
       where user_id = ?
       order by last_used_at desc, name asc`;

  const items = hasPagination
    ? db.prepare(sql).all(req.userId, limit, offset)
    : db.prepare(sql).all(req.userId);

  res.json({ data: items });
});

app.get('/food-categories', authMiddleware, (_req: AuthenticatedRequest, res) => {
  const categories = db
    .prepare(
      `select id, name, sort_order, icon
       from food_categories
       order by sort_order asc, name asc`
    )
    .all();
  res.json({ data: categories });
});

app.get('/food-catalog-items', authMiddleware, (_req: AuthenticatedRequest, res) => {
  const items = db
    .prepare(
      `select
         ci.id,
         ci.category_id,
         c.name as category_name,
         ci.name,
         ci.icon,
         ci.default_unit,
         ci.default_location,
         ci.default_quantity
       from food_catalog_items ci
       inner join food_categories c on c.id = ci.category_id
       order by c.sort_order asc, ci.name asc`
    )
    .all();
  res.json({ data: items });
});

app.post('/food-items', authMiddleware, (req: AuthenticatedRequest, res) => {
  const name = formatInventoryName(String(req.body?.name ?? ''));
  const location = req.body?.location;
  const quantity = Number(req.body?.quantity ?? 1);

  if (!name) {
    res.status(400).json({ error: 'Name is required.' });
    return;
  }

  if (!['fridge', 'freezer', 'pantry'].includes(location)) {
    res.status(400).json({ error: 'Location must be fridge, freezer, or pantry.' });
    return;
  }

  const id = crypto.randomUUID();
  const category = req.body?.category?.trim() || null;
  const unit = req.body?.unit?.trim() || null;
  const expiration_date = req.body?.expiration_date || null;

  db.prepare(
    `insert into food_items (id, user_id, name, category, quantity, unit, expiration_date, location)
     values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.userId, name, category, quantity, unit, expiration_date, location);

  const item = db
    .prepare(
      `select id, user_id, name, category, quantity, unit, expiration_date, location, created_at
       from food_items where id = ?`
    )
    .get(id);

  upsertFoodItemHistory(req.userId!, {
    name,
    category,
    unit,
    location,
    default_quantity: quantity,
  });

  res.status(201).json({ data: item });
});

app.patch('/food-items/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const existing = db
    .prepare('select id from food_items where id = ? and user_id = ?')
    .get(req.params['id'], req.userId);

  if (!existing) {
    res.status(404).json({ error: 'Food item not found.' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  const updatable = ['name', 'category', 'quantity', 'unit', 'expiration_date', 'location'] as const;
  for (const field of updatable) {
    if (req.body?.[field] !== undefined) {
      let value = req.body[field];
      if (field === 'name') {
        value = formatInventoryName(String(value));
      }
      if (field === 'category' || field === 'unit') {
        value = value?.trim() || null;
      }
      if (field === 'expiration_date' && value === '') {
        value = null;
      }
      fields.push(`${field} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update.' });
    return;
  }

  values.push(req.params['id'], req.userId);
  db.prepare(
    `update food_items set ${fields.join(', ')} where id = ? and user_id = ?`
  ).run(...values);

  const item = db
    .prepare(
      `select id, user_id, name, category, quantity, unit, expiration_date, location, created_at
       from food_items where id = ?`
    )
    .get(req.params['id']) as {
    id: string;
    user_id: string;
    name: string;
    category: string | null;
    quantity: number;
    unit: string | null;
    expiration_date: string | null;
    location: string;
    created_at: string;
  };

  upsertFoodItemHistory(req.userId!, {
    name: item.name,
    category: item.category,
    unit: item.unit,
    location: item.location,
    default_quantity: item.quantity,
  });

  res.json({ data: item });
});

app.delete('/food-items/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const result = db
    .prepare('delete from food_items where id = ? and user_id = ?')
    .run(req.params['id'], req.userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Food item not found.' });
    return;
  }

  res.status(204).send();
});

app.get('/recipes', authMiddleware, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(
      `select id, user_id, title, description, prep_time_minutes, portions, tags, created_at
       from recipes
       where user_id = ?
       order by created_at desc`
    )
    .all(req.userId) as RecipeRow[];

  res.json({ data: rows.map(serializeRecipe) });
});

app.get('/recipes/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const row = getRecipeRow(req.params['id']!, req.userId!);

  if (!row) {
    res.status(404).json({ error: 'Recipe not found.' });
    return;
  }

  res.json({ data: serializeRecipe(row) });
});

app.post('/recipes', authMiddleware, (req: AuthenticatedRequest, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) {
    res.status(400).json({ error: 'Title is required.' });
    return;
  }

  const id = crypto.randomUUID();
  const description = req.body?.description?.trim?.() || null;
  const prep_time_minutes = toIntOrNull(req.body?.prep_time_minutes);
  const portions = toIntOrNull(req.body?.portions);
  const tags = JSON.stringify(normalizeTags(req.body?.tags));

  db.prepare(
    `insert into recipes (id, user_id, title, description, prep_time_minutes, portions, tags)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.userId, title, description, prep_time_minutes, portions, tags);

  replaceRecipeIngredients(id, req.body?.ingredients);

  res.status(201).json({ data: serializeRecipe(getRecipeRow(id, req.userId!)!) });
});

app.put('/recipes/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const existing = getRecipeRow(req.params['id']!, req.userId!);
  if (!existing) {
    res.status(404).json({ error: 'Recipe not found.' });
    return;
  }

  const title = String(req.body?.title ?? '').trim();
  if (!title) {
    res.status(400).json({ error: 'Title is required.' });
    return;
  }

  const description = req.body?.description?.trim?.() || null;
  const prep_time_minutes = toIntOrNull(req.body?.prep_time_minutes);
  const portions = toIntOrNull(req.body?.portions);
  const tags = JSON.stringify(normalizeTags(req.body?.tags));

  db.prepare(
    `update recipes
     set title = ?, description = ?, prep_time_minutes = ?, portions = ?, tags = ?
     where id = ? and user_id = ?`
  ).run(title, description, prep_time_minutes, portions, tags, req.params['id'], req.userId);

  replaceRecipeIngredients(req.params['id']!, req.body?.ingredients);

  res.json({ data: serializeRecipe(getRecipeRow(req.params['id']!, req.userId!)!) });
});

app.delete('/recipes/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const result = db
    .prepare('delete from recipes where id = ? and user_id = ?')
    .run(req.params['id'], req.userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Recipe not found.' });
    return;
  }

  res.status(204).send();
});

app.get('/prepared-portions', authMiddleware, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(
      `select id, user_id, name, source_type, recipe_id, total_portions, available_portions,
              cooked_at, expires_at, storage_location, notes, status, created_at, updated_at
       from prepared_portions
       where user_id = ?
       order by expires_at asc nulls last, created_at desc`
    )
    .all(req.userId) as PreparedPortionRow[];

  res.json({ data: rows.map(serializePreparedPortion) });
});

app.post('/prepared-portions', authMiddleware, (req: AuthenticatedRequest, res) => {
  const name = String(req.body?.name ?? '').trim();
  const sourceType = String(req.body?.source_type ?? 'custom').trim();
  const totalPortions = Math.max(1, toIntOrNull(req.body?.total_portions) ?? 1);
  const availablePortions = toIntOrNull(req.body?.available_portions) ?? totalPortions;

  if (!name) {
    res.status(400).json({ error: 'Name is required.' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `insert into prepared_portions (
       id, user_id, name, source_type, recipe_id, total_portions, available_portions,
       cooked_at, expires_at, storage_location, notes, status, created_at, updated_at
     ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.userId,
    name,
    sourceType,
    req.body?.recipe_id ?? null,
    totalPortions,
    availablePortions,
    req.body?.cooked_at ?? now.slice(0, 10),
    req.body?.expires_at ?? null,
    req.body?.storage_location ?? 'fridge',
    req.body?.notes?.trim?.() || null,
    req.body?.status ?? 'available',
    now,
    now
  );

  const row = getPreparedPortionRow(id, req.userId!);
  res.json({ data: serializePreparedPortion(row!) });
});

app.patch('/prepared-portions/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const existing = getPreparedPortionRow(req.params['id']!, req.userId!);
  if (!existing) {
    res.status(404).json({ error: 'Ready portion not found.' });
    return;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  const fields: Record<string, unknown> = {
    name: req.body?.name?.trim?.(),
    source_type: req.body?.source_type,
    total_portions: toIntOrNull(req.body?.total_portions),
    available_portions: toIntOrNull(req.body?.available_portions),
    cooked_at: req.body?.cooked_at,
    expires_at: req.body?.expires_at,
    storage_location: req.body?.storage_location,
    notes: req.body?.notes !== undefined ? req.body.notes?.trim?.() || null : undefined,
    status: req.body?.status,
    updated_at: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    res.json({ data: serializePreparedPortion(existing) });
    return;
  }

  values.push(req.params['id'], req.userId);
  db.prepare(
    `update prepared_portions set ${updates.join(', ')} where id = ? and user_id = ?`
  ).run(...values);

  const row = getPreparedPortionRow(req.params['id']!, req.userId!);
  res.json({ data: serializePreparedPortion(row!) });
});

app.delete('/prepared-portions/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const result = db
    .prepare('delete from prepared_portions where id = ? and user_id = ?')
    .run(req.params['id'], req.userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Ready portion not found.' });
    return;
  }

  res.status(204).send();
});

app.get('/meal-plan-items/today', authMiddleware, (req: AuthenticatedRequest, res) => {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const rows = db
    .prepare(
      `select id, user_id, date, meal_type, item_type, recipe_id, prepared_portion_id,
              inventory_item_id, custom_name, quantity, unit, portions_used, notes, sort_order,
              status, completed_at, created_at
       from meal_plan_items
       where user_id = ? and date = ?
       order by meal_type asc, sort_order asc`
    )
    .all(req.userId, date) as MealPlanItemRow[];

  res.json({ data: rows.map(serializeMealPlanItem) });
});

app.get('/meal-plan-items', authMiddleware, (req: AuthenticatedRequest, res) => {
  const start = String(req.query['start'] ?? '');
  const end = String(req.query['end'] ?? '');

  if (!start || !end) {
    res.status(400).json({ error: 'Start and end dates are required.' });
    return;
  }

  const rows = db
    .prepare(
      `select id, user_id, date, meal_type, item_type, recipe_id, prepared_portion_id,
              inventory_item_id, custom_name, quantity, unit, portions_used, notes, sort_order,
              status, completed_at, created_at
       from meal_plan_items
       where user_id = ? and date >= ? and date <= ?
       order by date asc, meal_type asc, sort_order asc`
    )
    .all(req.userId, start, end) as MealPlanItemRow[];

  res.json({ data: rows.map(serializeMealPlanItem) });
});

app.post('/meal-plan-items', authMiddleware, (req: AuthenticatedRequest, res) => {
  const date = String(req.body?.date ?? '').trim();
  const mealType = String(req.body?.meal_type ?? '').trim();
  const itemType = String(req.body?.item_type ?? '').trim();

  if (!date || !mealType || !itemType) {
    res.status(400).json({ error: 'Date, meal type, and item type are required.' });
    return;
  }

  if (!VALID_MEAL_TYPES.has(mealType) || !VALID_ITEM_TYPES.has(itemType)) {
    res.status(400).json({ error: 'Invalid meal type or item type.' });
    return;
  }

  const id = crypto.randomUUID();
  const sortOrder = toIntOrNull(req.body?.sort_order) ?? 0;
  const portionsUsed = Math.max(1, toIntOrNull(req.body?.portions_used) ?? 1);

  db.prepare(
    `insert into meal_plan_items (
       id, user_id, date, meal_type, item_type, recipe_id, prepared_portion_id,
       inventory_item_id, custom_name, quantity, unit, portions_used, notes, sort_order
     ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.userId,
    date,
    mealType,
    itemType,
    req.body?.recipe_id ?? null,
    req.body?.prepared_portion_id ?? null,
    req.body?.inventory_item_id ?? null,
    req.body?.custom_name?.trim?.() ?? null,
    toNumberOrNull(req.body?.quantity),
    req.body?.unit?.trim?.() || null,
    portionsUsed,
    req.body?.notes?.trim?.() || null,
    sortOrder
  );

  const row = getMealPlanItemRow(id, req.userId!);
  res.json({ data: serializeMealPlanItem(row!) });
});

app.post('/meal-plan-items/duplicate-week', authMiddleware, (req: AuthenticatedRequest, res) => {
  const targetWeekStart = String(req.body?.targetWeekStart ?? '').trim();

  if (!targetWeekStart) {
    res.status(400).json({ error: 'Target week start date is required.' });
    return;
  }

  const previousStart = addDaysIso(targetWeekStart, -7);
  const previousEnd = addDaysIso(targetWeekStart, -1);

  const sourceRows = db
    .prepare(
      `select date, meal_type, item_type, recipe_id, inventory_item_id, custom_name,
              quantity, unit, portions_used, notes, sort_order
       from meal_plan_items
       where user_id = ? and date >= ? and date <= ?`
    )
    .all(req.userId, previousStart, previousEnd) as MealPlanItemRow[];

  const targetEnd = addDaysIso(targetWeekStart, 6);
  const existingRows = db
    .prepare(
      `select date, meal_type
       from meal_plan_items
       where user_id = ? and date >= ? and date <= ?`
    )
    .all(req.userId, targetWeekStart, targetEnd) as { date: string; meal_type: string }[];

  const occupied = new Set(existingRows.map((row) => `${row.date}|${row.meal_type}`));
  const insert = db.prepare(
    `insert into meal_plan_items (
       id, user_id, date, meal_type, item_type, recipe_id, inventory_item_id,
       custom_name, quantity, unit, portions_used, notes, sort_order
     ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let copiedCount = 0;

  for (const row of sourceRows) {
    if (row.item_type === 'prepared_portion') {
      continue;
    }

    const targetDate = addDaysIso(row.date, 7);
    const key = `${targetDate}|${row.meal_type}`;

    if (occupied.has(key)) {
      continue;
    }

    insert.run(
      crypto.randomUUID(),
      req.userId,
      targetDate,
      row.meal_type,
      row.item_type,
      row.recipe_id,
      row.inventory_item_id,
      row.custom_name,
      row.quantity,
      row.unit,
      row.portions_used,
      row.notes,
      row.sort_order
    );
    occupied.add(key);
    copiedCount++;
  }

  res.json({ data: { copiedCount } });
});

const VALID_SLOT_ITEM_STATUSES = new Set(['planned', 'prepared', 'eaten', 'skipped']);

app.patch('/meal-plan-items/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const existing = getMealPlanItemRow(req.params['id']!, req.userId!);
  if (!existing) {
    res.status(404).json({ error: 'Meal plan item not found.' });
    return;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (req.body?.status !== undefined) {
    const status = String(req.body.status);
    if (!VALID_SLOT_ITEM_STATUSES.has(status)) {
      res.status(400).json({ error: 'Invalid status.' });
      return;
    }
    updates.push('status = ?');
    values.push(status);
  }

  if (req.body?.completed_at !== undefined) {
    updates.push('completed_at = ?');
    values.push(req.body.completed_at ?? null);
  }

  if (req.body?.notes !== undefined) {
    updates.push('notes = ?');
    values.push(req.body.notes?.trim?.() || null);
  }

  if (updates.length === 0) {
    res.json({ data: serializeMealPlanItem(existing) });
    return;
  }

  values.push(req.params['id'], req.userId);
  db.prepare(
    `update meal_plan_items set ${updates.join(', ')} where id = ? and user_id = ?`
  ).run(...values);

  const row = getMealPlanItemRow(req.params['id']!, req.userId!);
  res.json({ data: serializeMealPlanItem(row!) });
});

app.delete('/meal-plan-items/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const result = db
    .prepare('delete from meal_plan_items where id = ? and user_id = ?')
    .run(req.params['id'], req.userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Meal plan item not found.' });
    return;
  }

  res.status(204).send();
});

app.get('/shopping-items', authMiddleware, (req: AuthenticatedRequest, res) => {
  const items = db
    .prepare(
      `select id, user_id, name, quantity, unit, is_checked, source, created_at
       from shopping_items
       where user_id = ?
       order by is_checked asc, created_at asc`
    )
    .all(req.userId)
    .map((row) => ({
      ...(row as Record<string, unknown>),
      is_checked: Boolean((row as { is_checked: number }).is_checked),
    }));
  res.json({ data: items });
});

app.post('/shopping-items', authMiddleware, (req: AuthenticatedRequest, res) => {
  const name = String(req.body?.name ?? '').trim();
  const source = req.body?.source ?? 'manual';

  if (!name) {
    res.status(400).json({ error: 'Name is required.' });
    return;
  }

  if (!['manual', 'meal_plan'].includes(source)) {
    res.status(400).json({ error: 'Source must be manual or meal_plan.' });
    return;
  }

  const id = crypto.randomUUID();
  const quantity = toNumberOrNull(req.body?.quantity);
  const unit = req.body?.unit?.trim() || null;

  db.prepare(
    `insert into shopping_items (id, user_id, name, quantity, unit, source)
     values (?, ?, ?, ?, ?, ?)`
  ).run(id, req.userId, name, quantity, unit, source);

  const item = db
    .prepare(
      `select id, user_id, name, quantity, unit, is_checked, source, created_at
       from shopping_items where id = ?`
    )
    .get(id) as {
    id: string;
    user_id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    is_checked: number;
    source: string;
    created_at: string;
  };

  res.status(201).json({
    data: {
      ...item,
      is_checked: Boolean(item.is_checked),
    },
  });
});

app.patch('/shopping-items/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const existing = db
    .prepare('select id from shopping_items where id = ? and user_id = ?')
    .get(req.params['id'], req.userId);

  if (!existing) {
    res.status(404).json({ error: 'Shopping item not found.' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  const updatable = ['name', 'quantity', 'unit', 'is_checked'] as const;
  for (const field of updatable) {
    if (req.body?.[field] !== undefined) {
      let value = req.body[field];
      if (field === 'name') {
        value = String(value).trim();
      }
      if (field === 'unit') {
        value = value?.trim() || null;
      }
      if (field === 'quantity') {
        value = toNumberOrNull(value);
      }
      if (field === 'is_checked') {
        value = value ? 1 : 0;
      }
      fields.push(`${field} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update.' });
    return;
  }

  values.push(req.params['id'], req.userId);
  db.prepare(
    `update shopping_items set ${fields.join(', ')} where id = ? and user_id = ?`
  ).run(...values);

  const item = db
    .prepare(
      `select id, user_id, name, quantity, unit, is_checked, source, created_at
       from shopping_items where id = ?`
    )
    .get(req.params['id']) as {
    id: string;
    user_id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    is_checked: number;
    source: string;
    created_at: string;
  };

  res.json({
    data: {
      ...item,
      is_checked: Boolean(item.is_checked),
    },
  });
});

app.delete('/shopping-items/checked', authMiddleware, (req: AuthenticatedRequest, res) => {
  db.prepare('delete from shopping_items where user_id = ? and is_checked = 1').run(req.userId);
  res.status(204).send();
});

app.delete('/shopping-items', authMiddleware, (req: AuthenticatedRequest, res) => {
  db.prepare('delete from shopping_items where user_id = ?').run(req.userId);
  res.status(204).send();
});

app.delete('/shopping-items/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const result = db
    .prepare('delete from shopping_items where id = ? and user_id = ?')
    .run(req.params['id'], req.userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Shopping item not found.' });
    return;
  }

  res.status(204).send();
});

function addDaysIso(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

app.listen(PORT, () => {
  console.log(`Local SQLite API running at http://localhost:${PORT}`);
  console.log('Seeded user: dev@local.test / password');
});
