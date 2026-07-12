import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface AiOnboardingContext {
  dietaryPreferences: string[];
  allergies: string[];
  dislikedIngredients: string[];
  goals: string[];
  cookingEffort: string;
  extraInventory?: string[];
}

interface AiRecipeSuggestionRequest {
  mealType: MealType;
  maxPrepTimeMinutes: number;
  prioritizeExpiringIngredients: boolean;
  includeMissingIngredients: boolean;
  numberOfSuggestions: number;
  onboardingContext?: AiOnboardingContext;
  excludeTitles?: string[];
  customPrompt?: string;
  idempotencyKey?: string;
}

interface FoodItemForPrompt {
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  expiration_date: string | null;
  location: 'fridge' | 'freezer' | 'pantry';
  created_at: string;
}

interface InventoryItemForPrompt {
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  location: 'fridge' | 'freezer' | 'pantry';
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
}

interface AiRecipeIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

interface AiRecipeSuggestion {
  title: string;
  description: string;
  prepTimeMinutes: number;
  portions: number;
  difficulty: 'easy';
  tags: string[];
  ingredients: AiRecipeIngredient[];
  steps: string[];
  usedInventoryIngredients: string[];
  missingIngredients: AiRecipeIngredient[];
  reason: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const maxInventoryItems = 50;
const maxSuggestions = 5;
const defaultRecipeModel = 'gpt-4o';
const expiringSoonDays = 7;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({}, 200);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'You must be signed in to generate recipes.' }, 401);
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return jsonResponse({ error: 'AI recipe generation is not configured yet.' }, 500);
    }

    const body = await req.json();
    const request = cleanRequest(body);
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'You must be signed in to generate recipes.' }, 401);
    }

    const idempotencyKey = toNonEmptyString(body.idempotencyKey);
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (serviceRoleKey) {
      const serviceClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: allowance, error: allowanceError } = await serviceClient.rpc(
        'check_smart_suggestion_allowance',
        { p_user_id: userData.user.id }
      );
      if (allowanceError) {
        return jsonResponse({ error: 'Could not verify usage allowance.' }, 500);
      }
      if (allowance && allowance.allowed === false) {
        return jsonResponse(
          {
            error: 'You have used all AI recipe generations for this month.',
            code: 'SMART_SUGGESTION_LIMIT_REACHED',
            usage: allowance.usage,
          },
          429
        );
      }
    }

    const { data, error } = await supabase
      .from('food_items')
      .select('name, category, quantity, unit, expiration_date, location, created_at')
      .order('expiration_date', { ascending: true, nullsFirst: false });

    if (error) {
      return jsonResponse({ error: 'Could not load your inventory right now.' }, 500);
    }

    let inventory = selectInventoryItems(
      normalizeInventory(data),
      request.prioritizeExpiringIngredients
    );

    const extraNames = request.onboardingContext?.extraInventory ?? [];
    for (const name of extraNames) {
      if (!name?.trim()) continue;
      if (inventory.some((item) => item.name.toLowerCase() === name.toLowerCase())) continue;
      inventory.push({
        name: name.trim(),
        category: null,
        quantity: 1,
        unit: null,
        expiration_date: null,
        location: 'pantry',
        created_at: new Date().toISOString(),
      });
    }

    const canGenerateWithoutInventory =
      request.includeMissingIngredients && Boolean(request.customPrompt);

    if (inventory.length === 0 && !request.onboardingContext && !canGenerateWithoutInventory) {
      return jsonResponse({ suggestions: [] });
    }

    const inventoryForPrompt = enrichInventoryForPrompt(inventory);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:
          Deno.env.get('OPENAI_RECIPE_MODEL') ||
          Deno.env.get('OPENAI_MODEL') ||
          defaultRecipeModel,
        temperature: 0.65,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(),
          },
          {
            role: 'user',
            content: buildUserPrompt(request, inventoryForPrompt),
          },
        ],
      }),
    });

    if (!response.ok) {
      return jsonResponse({ error: 'Could not generate recipes right now.' }, 502);
    }

    const openAiPayload = await response.json();
    const content = openAiPayload?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const suggestions = validateSuggestions(parsed, request.includeMissingIngredients);

    if (serviceRoleKey && idempotencyKey) {
      const serviceClient = createClient(supabaseUrl, serviceRoleKey);
      const { error: recordError } = await serviceClient.rpc('record_smart_suggestion_usage', {
        p_user_id: userData.user.id,
        p_idempotency_key: idempotencyKey,
      });
      if (recordError && !String(recordError.message).includes('SMART_SUGGESTION_LIMIT_REACHED')) {
        console.error('Failed to record smart suggestion usage');
      }
    }

    return jsonResponse({ suggestions });
  } catch {
    return jsonResponse({ error: 'Could not generate recipes right now. Please try again.' }, 500);
  }
});

function cleanRequest(input: unknown): AiRecipeSuggestionRequest {
  const body = isRecord(input) ? input : {};
  const mealType = isMealType(body.mealType) ? body.mealType : 'dinner';
  const maxPrepTimeMinutes = clampNumber(body.maxPrepTimeMinutes, 15, 60, 30);
  const numberOfSuggestions = clampNumber(body.numberOfSuggestions, 1, maxSuggestions, 2);

  const onboardingContext = cleanOnboardingContext(body.onboardingContext);
  const excludeTitles = normalizeStringArray(body.excludeTitles).slice(0, 10);
  const customPrompt = toNonEmptyString(body.customPrompt)?.slice(0, 200);

  return {
    mealType,
    maxPrepTimeMinutes,
    prioritizeExpiringIngredients: Boolean(body.prioritizeExpiringIngredients),
    includeMissingIngredients: Boolean(body.includeMissingIngredients),
    numberOfSuggestions,
    onboardingContext,
    excludeTitles: excludeTitles.length > 0 ? excludeTitles : undefined,
    customPrompt,
  };
}

function cleanOnboardingContext(input: unknown): AiOnboardingContext | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  return {
    dietaryPreferences: normalizeStringArray(input.dietaryPreferences),
    allergies: normalizeStringArray(input.allergies),
    dislikedIngredients: normalizeStringArray(input.dislikedIngredients),
    goals: normalizeStringArray(input.goals),
    cookingEffort: toNonEmptyString(input.cookingEffort) ?? 'two_cooking_sessions',
    extraInventory: normalizeStringArray(input.extraInventory),
  };
}

function normalizeInventory(data: unknown): FoodItemForPrompt[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => item as FoodItemForPrompt)
    .filter((item) => item.name && !isExpired(item.expiration_date))
    .map((item) => ({
      name: item.name,
      category: item.category ?? null,
      quantity: Number(item.quantity) || 1,
      unit: item.unit ?? null,
      expiration_date: item.expiration_date ?? null,
      location: item.location,
      created_at: item.created_at,
    }));
}

function selectInventoryItems(
  inventory: FoodItemForPrompt[],
  prioritizeExpiringIngredients: boolean
): FoodItemForPrompt[] {
  return [...inventory]
    .sort((a, b) => {
      if (prioritizeExpiringIngredients) {
        const expirationCompare = compareNullableDates(a.expiration_date, b.expiration_date);
        if (expirationCompare !== 0) {
          return expirationCompare;
        }
      }
      return compareNullableDates(b.created_at, a.created_at);
    })
    .slice(0, maxInventoryItems);
}

function enrichInventoryForPrompt(inventory: FoodItemForPrompt[]): InventoryItemForPrompt[] {
  const today = new Date();

  return inventory.map((item) => {
    const daysUntilExpiry = getDaysUntilExpiration(item.expiration_date, today);
    return {
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      location: item.location,
      daysUntilExpiry,
      isExpiringSoon:
        daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= expiringSoonDays,
    };
  });
}

function getDaysUntilExpiration(date: string | null, today: Date): number | null {
  if (!date) {
    return null;
  }
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.round((startOfDate.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
}

function buildSystemPrompt(): string {
  return [
    'You generate practical, specific recipe suggestions for a personal meal planner.',
    'Return only valid JSON with a top-level "suggestions" array.',
    'Recipes must be realistic, safe, and suitable for a normal home kitchen.',
    'Use specific dish names — never generic titles like "Quick Pasta", "Easy Bowl", or "Simple Stir Fry".',
    'Prefer recognizable dish names with cuisine or style cues when appropriate.',
    'Ingredient quantities must be realistic for home cooking; steps must be clear and actionable.',
    'Avoid allergies, medical claims, dangerous instructions, and overly fancy techniques.',
    'Use basic pantry staples only when needed: salt, pepper, oil, water, and basic spices.',
    'Strictly follow dietary preferences and allergies from onboarding context.',
    'Include matching dietary tags on each recipe (e.g. vegetarian, vegan, gluten-free).',
  ].join(' ');
}

function buildDietaryPreferenceRules(preferences: string[]): string[] {
  const rules: string[] = [];
  const active = preferences.filter((preference) => preference !== 'none' && preference !== 'flexitarian');

  for (const preference of active) {
    switch (preference) {
      case 'vegetarian':
        rules.push('STRICT: Vegetarian — no meat, poultry, or fish.');
        break;
      case 'vegan':
        rules.push('STRICT: Vegan — no animal products (meat, fish, dairy, eggs, honey).');
        break;
      case 'pescatarian':
        rules.push('STRICT: Pescatarian — no meat or poultry; fish and seafood are allowed.');
        break;
      case 'gluten_free':
        rules.push('STRICT: Gluten-free — no wheat, bread, pasta, couscous, or gluten-containing grains.');
        break;
      case 'dairy_free':
        rules.push('STRICT: Dairy-free — no milk, cheese, yogurt, butter, or cream.');
        break;
      case 'low_carb':
        rules.push('Prefer low-carb ingredients; minimize rice, pasta, bread, and potatoes.');
        break;
      case 'high_protein':
        rules.push('Prefer high-protein ingredients such as legumes, eggs, fish, or lean meat.');
        break;
      case 'mediterranean':
        rules.push('Prefer Mediterranean-style meals with olive oil, vegetables, legumes, and fish.');
        break;
      case 'budget_friendly':
        rules.push('Prefer budget-friendly pantry staples and simple ingredients.');
        break;
      case 'quick_meals':
        rules.push('Keep recipes quick and simple within maxPrepTimeMinutes.');
        break;
      case 'meal_prep_focused':
        rules.push('Prefer recipes suitable for batch cooking and meal prep.');
        break;
      default:
        break;
    }
  }

  return rules;
}

function buildUserPrompt(
  request: AiRecipeSuggestionRequest,
  inventory: InventoryItemForPrompt[]
): string {
  const missingRule = request.includeMissingIngredients
    ? 'Missing ingredients are allowed, but keep them minimal and practical for a normal grocery run.'
    : 'Do not include missing ingredients except basic pantry staples.';
  const expiringRule = request.prioritizeExpiringIngredients
    ? 'Strongly prefer recipes that use ingredients marked isExpiringSoon or with low daysUntilExpiry.'
    : 'Use available ingredients naturally without over-prioritizing expiration dates.';
  const distinctRule =
    request.numberOfSuggestions >= 2
      ? 'Each suggestion must use a distinctly different approach (cooking method, cuisine, texture, or meal style).'
      : null;
  const customPromptRule = request.customPrompt
    ? `PRIMARY creative direction from the user — honor this above all other preferences when safe: "${request.customPrompt}".`
    : null;

  const allergyRule =
    request.onboardingContext?.allergies?.length
      ? `STRICT: Never include these allergens: ${request.onboardingContext.allergies.join(', ')}.`
      : null;

  const dietaryRules = buildDietaryPreferenceRules(
    request.onboardingContext?.dietaryPreferences ?? []
  );

  return JSON.stringify({
    task: request.customPrompt
      ? 'Generate specific, realistic recipe suggestions guided by the user request.'
      : 'Generate specific, realistic recipe suggestions from this inventory.',
    preferences: {
      mealType: request.mealType,
      maxPrepTimeMinutes: request.maxPrepTimeMinutes,
      difficulty: 'easy',
      numberOfSuggestions: request.numberOfSuggestions,
      includeMissingIngredients: request.includeMissingIngredients,
      prioritizeExpiringIngredients: request.prioritizeExpiringIngredients,
      customPrompt: request.customPrompt ?? null,
      onboarding: request.onboardingContext ?? null,
    },
    rules: [
      missingRule,
      expiringRule,
      distinctRule,
      customPromptRule,
      allergyRule,
      ...dietaryRules,
      request.onboardingContext?.dislikedIngredients?.length
        ? `Avoid these disliked ingredients when possible: ${request.onboardingContext.dislikedIngredients.join(', ')}.`
        : null,
      request.excludeTitles?.length
        ? `Do not repeat these recipe titles: ${request.excludeTitles.join(', ')}.`
        : null,
      'Every recipe must fit within maxPrepTimeMinutes.',
      'Prefer available inventory ingredients over unrelated ingredients.',
      'Use specific dish titles, not generic placeholders.',
      'Keep steps short, clear, and actionable — no vague instructions.',
      'Add tags that reflect dietary preferences (e.g. vegetarian, vegan, gluten-free).',
    ].filter(Boolean),
    inventory,
    outputFormat: {
      suggestions: [
        {
          title: 'string',
          description: 'string',
          prepTimeMinutes: 30,
          portions: 2,
          difficulty: 'easy',
          tags: ['quick', 'cheap'],
          ingredients: [{ name: 'string', quantity: 1, unit: 'string' }],
          steps: ['string'],
          usedInventoryIngredients: ['string'],
          missingIngredients: [{ name: 'string', quantity: 1, unit: 'string' }],
          reason: 'string',
        },
      ],
    },
  });
}

function validateSuggestions(
  payload: unknown,
  includeMissingIngredients: boolean
): AiRecipeSuggestion[] {
  if (!isRecord(payload) || !Array.isArray(payload.suggestions)) {
    throw new Error('Invalid AI response.');
  }

  const suggestions = payload.suggestions
    .map((item) => normalizeSuggestion(item, includeMissingIngredients))
    .filter((item): item is AiRecipeSuggestion => item !== null);

  if (suggestions.length === 0) {
    throw new Error('Invalid AI response.');
  }

  return suggestions.slice(0, maxSuggestions);
}

function normalizeSuggestion(
  input: unknown,
  includeMissingIngredients: boolean
): AiRecipeSuggestion | null {
  if (!isRecord(input)) {
    return null;
  }

  const title = toNonEmptyString(input.title);
  const ingredients = normalizeIngredients(input.ingredients);
  const steps = normalizeStringArray(input.steps);
  const prepTimeMinutes = Number(input.prepTimeMinutes);
  const difficulty = input.difficulty;
  const missingIngredients = normalizeIngredients(input.missingIngredients);

  if (
    !title ||
    ingredients.length === 0 ||
    steps.length === 0 ||
    !Number.isFinite(prepTimeMinutes) ||
    difficulty !== 'easy' ||
    (!includeMissingIngredients && missingIngredients.length > 0)
  ) {
    return null;
  }

  return {
    title,
    description: toNonEmptyString(input.description) ?? '',
    prepTimeMinutes,
    portions: Number(input.portions) || 1,
    difficulty: 'easy',
    tags: normalizeTags(input.tags).slice(0, 6),
    ingredients,
    steps,
    usedInventoryIngredients: normalizeStringArray(input.usedInventoryIngredients),
    missingIngredients,
    reason: toNonEmptyString(input.reason) ?? 'Uses ingredients you already have.',
  };
}

function normalizeIngredients(input: unknown): AiRecipeIngredient[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const name = toNonEmptyString(item.name);
      if (!name) {
        return null;
      }
      return {
        name,
        quantity: typeof item.quantity === 'number' ? item.quantity : null,
        unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : null,
      };
    })
    .filter((item): item is AiRecipeIngredient => item !== null);
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTags(input: unknown): string[] {
  const tags = new Set<string>();
  for (const tag of normalizeStringArray(input)) {
    const normalized = tag.toLowerCase();
    if (normalized) {
      tags.add(normalized);
    }
  }
  return [...tags];
}

function isExpired(date: string | null): boolean {
  if (!date) {
    return false;
  }
  const today = new Date();
  const parsed = new Date(`${date}T00:00:00`);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return parsed.getTime() < startOfToday.getTime();
}

function compareNullableDates(a: string | null, b: string | null): number {
  if (a && b) {
    return a.localeCompare(b);
  }
  if (a) {
    return -1;
  }
  if (b) {
    return 1;
  }
  return 0;
}

function clampNumber(input: unknown, min: number, max: number, fallback: number): number {
  const value = Number(input);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(value), min), max);
}

function isMealType(value: unknown): value is MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack';
}

function toNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
