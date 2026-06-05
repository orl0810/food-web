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
       set name = ?, category = ?, unit = ?, location = ?, default_quantity = ?, last_used_at = datetime('now')
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
       id, user_id, name, name_key, category, unit, location, default_quantity
     ) values (?, ?, ?, ?, ?, ?, ?, ?)`
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
  return value
    .map((tag) => String(tag).trim())
    .filter((tag) => tag.length > 0);
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

interface MealPlanRow {
  id: string;
  user_id: string;
  date: string;
  meal_type: string;
  recipe_id: string | null;
  created_at: string;
}

const VALID_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

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
    tags,
    prep_time_minutes: row.prep_time_minutes,
  };
}

function serializeMealPlanEntry(row: MealPlanRow) {
  const recipe = row.recipe_id
    ? serializeRecipeSummary(getRecipeRow(row.recipe_id, row.user_id))
    : null;

  return {
    ...row,
    recipe: recipe ?? undefined,
  };
}

function getMealPlanEntryRow(id: string, userId: string): MealPlanRow | undefined {
  return db
    .prepare(
      `select id, user_id, date, meal_type, recipe_id, created_at
       from meal_plan
       where id = ? and user_id = ?`
    )
    .get(id, userId) as MealPlanRow | undefined;
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
  const items = db
    .prepare(
      `select id, user_id, name, category, unit, location, default_quantity, last_used_at, created_at
       from food_item_history
       where user_id = ?
       order by last_used_at desc, name asc`
    )
    .all(req.userId);
  res.json({ data: items });
});

app.get('/food-categories', authMiddleware, (_req: AuthenticatedRequest, res) => {
  const categories = db
    .prepare(
      `select id, name, sort_order
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
  const name = String(req.body?.name ?? '').trim();
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
        value = String(value).trim();
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

app.get('/meal-plan/today', authMiddleware, (req: AuthenticatedRequest, res) => {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const rows = db
    .prepare(
      `select id, user_id, date, meal_type, recipe_id, created_at
       from meal_plan
       where user_id = ? and date = ?
       order by meal_type asc`
    )
    .all(req.userId, date) as MealPlanRow[];

  res.json({ data: rows.map(serializeMealPlanEntry) });
});

app.get('/meal-plan', authMiddleware, (req: AuthenticatedRequest, res) => {
  const start = String(req.query['start'] ?? '');
  const end = String(req.query['end'] ?? '');

  if (!start || !end) {
    res.status(400).json({ error: 'Start and end dates are required.' });
    return;
  }

  const rows = db
    .prepare(
      `select id, user_id, date, meal_type, recipe_id, created_at
       from meal_plan
       where user_id = ? and date >= ? and date <= ?
       order by date asc, meal_type asc`
    )
    .all(req.userId, start, end) as MealPlanRow[];

  res.json({ data: rows.map(serializeMealPlanEntry) });
});

app.put('/meal-plan', authMiddleware, (req: AuthenticatedRequest, res) => {
  const date = String(req.body?.date ?? '').trim();
  const mealType = String(req.body?.meal_type ?? '').trim();
  const recipeId = String(req.body?.recipe_id ?? '').trim();

  if (!date || !mealType || !recipeId) {
    res.status(400).json({ error: 'Date, meal type, and recipe are required.' });
    return;
  }

  if (!VALID_MEAL_TYPES.has(mealType)) {
    res.status(400).json({ error: 'Invalid meal type.' });
    return;
  }

  const recipe = getRecipeRow(recipeId, req.userId!);
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found.' });
    return;
  }

  const existing = db
    .prepare(
      `select id from meal_plan
       where user_id = ? and date = ? and meal_type = ?`
    )
    .get(req.userId, date, mealType) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `update meal_plan
       set recipe_id = ?
       where id = ? and user_id = ?`
    ).run(recipeId, existing.id, req.userId);

    const row = getMealPlanEntryRow(existing.id, req.userId!);
    res.json({ data: serializeMealPlanEntry(row!) });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `insert into meal_plan (id, user_id, date, meal_type, recipe_id)
     values (?, ?, ?, ?, ?)`
  ).run(id, req.userId, date, mealType, recipeId);

  const row = getMealPlanEntryRow(id, req.userId!);
  res.json({ data: serializeMealPlanEntry(row!) });
});

app.post('/meal-plan/duplicate-week', authMiddleware, (req: AuthenticatedRequest, res) => {
  const targetWeekStart = String(req.body?.targetWeekStart ?? '').trim();

  if (!targetWeekStart) {
    res.status(400).json({ error: 'Target week start date is required.' });
    return;
  }

  const previousStart = addDaysIso(targetWeekStart, -7);
  const previousEnd = addDaysIso(targetWeekStart, -1);

  const sourceRows = db
    .prepare(
      `select date, meal_type, recipe_id
       from meal_plan
       where user_id = ? and date >= ? and date <= ? and recipe_id is not null`
    )
    .all(req.userId, previousStart, previousEnd) as {
    date: string;
    meal_type: string;
    recipe_id: string;
  }[];

  const targetEnd = addDaysIso(targetWeekStart, 6);
  const existingRows = db
    .prepare(
      `select date, meal_type
       from meal_plan
       where user_id = ? and date >= ? and date <= ?`
    )
    .all(req.userId, targetWeekStart, targetEnd) as { date: string; meal_type: string }[];

  const occupied = new Set(existingRows.map((row) => `${row.date}|${row.meal_type}`));
  const insert = db.prepare(
    `insert into meal_plan (id, user_id, date, meal_type, recipe_id)
     values (?, ?, ?, ?, ?)`
  );

  let copiedCount = 0;

  for (const row of sourceRows) {
    const targetDate = addDaysIso(row.date, 7);
    const key = `${targetDate}|${row.meal_type}`;

    if (occupied.has(key)) {
      continue;
    }

    insert.run(crypto.randomUUID(), req.userId, targetDate, row.meal_type, row.recipe_id);
    occupied.add(key);
    copiedCount++;
  }

  res.json({ data: { copiedCount } });
});

app.delete('/meal-plan/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const result = db
    .prepare('delete from meal_plan where id = ? and user_id = ?')
    .run(req.params['id'], req.userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Meal plan entry not found.' });
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
