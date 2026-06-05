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

app.listen(PORT, () => {
  console.log(`Local SQLite API running at http://localhost:${PORT}`);
  console.log('Seeded user: dev@local.test / password');
});
