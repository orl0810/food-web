import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface AiRecipeSuggestionRequest {
  mealType: MealType;
  maxPrepTimeMinutes: number;
  prioritizeExpiringIngredients: boolean;
  includeMissingIngredients: boolean;
  numberOfSuggestions: number;
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
const defaultModel = 'gpt-4o-mini';

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

    const request = cleanRequest(await req.json());
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

    const { data, error } = await supabase
      .from('food_items')
      .select('name, category, quantity, unit, expiration_date, location, created_at')
      .order('expiration_date', { ascending: true, nullsFirst: false });

    if (error) {
      return jsonResponse({ error: 'Could not load your inventory right now.' }, 500);
    }

    const inventory = selectInventoryItems(
      normalizeInventory(data),
      request.prioritizeExpiringIngredients
    );

    if (inventory.length === 0) {
      return jsonResponse({ suggestions: [] });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || defaultModel,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(),
          },
          {
            role: 'user',
            content: buildUserPrompt(request, inventory),
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

    return jsonResponse({ suggestions });
  } catch {
    return jsonResponse({ error: 'Could not generate recipes right now. Please try again.' }, 500);
  }
});

function cleanRequest(input: unknown): AiRecipeSuggestionRequest {
  const body = isRecord(input) ? input : {};
  const mealType = isMealType(body.mealType) ? body.mealType : 'dinner';
  const maxPrepTimeMinutes = clampNumber(body.maxPrepTimeMinutes, 15, 60, 30);
  const numberOfSuggestions = clampNumber(body.numberOfSuggestions, 1, maxSuggestions, 3);

  return {
    mealType,
    maxPrepTimeMinutes,
    prioritizeExpiringIngredients: Boolean(body.prioritizeExpiringIngredients),
    includeMissingIngredients: Boolean(body.includeMissingIngredients),
    numberOfSuggestions,
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

function buildSystemPrompt(): string {
  return [
    'You generate practical recipe suggestions for a personal meal planner.',
    'Return only valid JSON with a top-level "suggestions" array.',
    'Recipes must be easy, realistic, safe, and suitable for a normal home kitchen.',
    'Avoid allergies, medical claims, dangerous instructions, and overly fancy techniques.',
    'Use basic pantry staples only when needed: salt, pepper, oil, water, and basic spices.',
  ].join(' ');
}

function buildUserPrompt(
  request: AiRecipeSuggestionRequest,
  inventory: FoodItemForPrompt[]
): string {
  const missingRule = request.includeMissingIngredients
    ? 'Missing ingredients are allowed, but keep them minimal.'
    : 'Do not include missing ingredients except basic pantry staples.';
  const expiringRule = request.prioritizeExpiringIngredients
    ? 'Prefer recipes that use ingredients expiring soon.'
    : 'Use available ingredients naturally without over-prioritizing expiration dates.';

  return JSON.stringify({
    task: 'Generate easy recipe suggestions from this inventory.',
    preferences: {
      mealType: request.mealType,
      maxPrepTimeMinutes: request.maxPrepTimeMinutes,
      difficulty: 'easy',
      numberOfSuggestions: request.numberOfSuggestions,
      includeMissingIngredients: request.includeMissingIngredients,
      prioritizeExpiringIngredients: request.prioritizeExpiringIngredients,
    },
    rules: [
      missingRule,
      expiringRule,
      'Every recipe must fit within maxPrepTimeMinutes.',
      'Prefer available inventory ingredients over unrelated ingredients.',
      'Keep steps short and clear.',
    ],
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
    tags: normalizeStringArray(input.tags).slice(0, 6),
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
