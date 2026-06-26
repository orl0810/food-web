import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

interface RecipeIngredientInput {
  name: string;
  quantity: number | null;
  unit: string | null;
}

interface EstimateNutritionRequest {
  title: string;
  description: string | null;
  portions: number | null;
  ingredients: RecipeIngredientInput[];
}

interface RecipeNutritionValues {
  calories: number;
  fat_g: number;
  cholesterol_mg: number;
  protein_g: number;
  sugar_g: number;
  sodium_mg: number;
  carbs_g: number;
  fiber_g: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
      return jsonResponse({ error: 'You must be signed in to estimate nutrition.' }, 401);
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return jsonResponse({ error: 'Nutrition estimation is not configured yet.' }, 500);
    }

    const request = cleanRequest(await req.json());
    if (request.ingredients.length === 0) {
      return jsonResponse({ error: 'At least one ingredient is required.' }, 400);
    }

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
      return jsonResponse({ error: 'You must be signed in to estimate nutrition.' }, 401);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || defaultModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(),
          },
          {
            role: 'user',
            content: buildUserPrompt(request),
          },
        ],
      }),
    });

    if (!response.ok) {
      return jsonResponse({ error: 'Could not estimate nutrition right now.' }, 502);
    }

    const openAiPayload = await response.json();
    const content = openAiPayload?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const nutrition = validateNutrition(parsed);

    if (!nutrition) {
      return jsonResponse({ error: 'Could not estimate nutrition right now.' }, 502);
    }

    return jsonResponse({ nutrition });
  } catch {
    return jsonResponse({ error: 'Could not estimate nutrition right now. Please try again.' }, 500);
  }
});

function buildSystemPrompt(): string {
  return [
    'You are a nutrition estimation assistant for a home meal planner app.',
    'Estimate per-portion nutrition for recipes based on typical ingredient amounts.',
    'When quantities are missing, assume sensible home-cooking portions.',
    'Return JSON only with this exact shape:',
    '{"nutrition":{"calories":number,"fat_g":number,"cholesterol_mg":number,"protein_g":number,"sugar_g":number,"sodium_mg":number,"carbs_g":number,"fiber_g":number}}',
    'All values must be non-negative numbers.',
    'calories is in kcal per portion.',
    'fat_g, protein_g, sugar_g, carbs_g, fiber_g are grams per portion.',
    'cholesterol_mg and sodium_mg are milligrams per portion.',
    'Values must reflect one serving/portion, not the entire recipe.',
  ].join(' ');
}

function buildUserPrompt(request: EstimateNutritionRequest): string {
  const portions = request.portions && request.portions > 0 ? request.portions : 4;
  const ingredientLines = request.ingredients
    .map((ingredient) => {
      const quantity =
        ingredient.quantity !== null && ingredient.quantity !== undefined
          ? `${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ''}`
          : 'unspecified amount';
      return `- ${ingredient.name}: ${quantity}`;
    })
    .join('\n');

  return [
    `Recipe title: ${request.title}`,
    request.description ? `Description: ${request.description}` : null,
    `Portions: ${portions}`,
    'Ingredients:',
    ingredientLines,
    '',
    `Estimate nutrition for ONE portion (1 of ${portions} servings).`,
  ]
    .filter(Boolean)
    .join('\n');
}

function cleanRequest(input: unknown): EstimateNutritionRequest {
  const body = isRecord(input) ? input : {};
  const title = toNonEmptyString(body.title) ?? 'Untitled recipe';
  const description = toNonEmptyString(body.description);
  const portions = toPositiveIntOrNull(body.portions);
  const ingredients = normalizeIngredients(body.ingredients);

  return { title, description, portions, ingredients };
}

function normalizeIngredients(input: unknown): RecipeIngredientInput[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item): RecipeIngredientInput | null => {
      if (!isRecord(item)) {
        return null;
      }
      const name = toNonEmptyString(item.name);
      if (!name) {
        return null;
      }
      return {
        name,
        quantity: toNumberOrNull(item.quantity),
        unit: toNonEmptyString(item.unit),
      };
    })
    .filter((item): item is RecipeIngredientInput => item !== null);
}

function validateNutrition(input: unknown): RecipeNutritionValues | null {
  if (!isRecord(input)) {
    return null;
  }

  const nutrition = isRecord(input.nutrition) ? input.nutrition : input;
  const calories = toNutritionNumber(nutrition.calories);
  const fat_g = toNutritionNumber(nutrition.fat_g);
  const cholesterol_mg = toNutritionNumber(nutrition.cholesterol_mg);
  const protein_g = toNutritionNumber(nutrition.protein_g);
  const sugar_g = toNutritionNumber(nutrition.sugar_g);
  const sodium_mg = toNutritionNumber(nutrition.sodium_mg);
  const carbs_g = toNutritionNumber(nutrition.carbs_g);
  const fiber_g = toNutritionNumber(nutrition.fiber_g);

  if (
    calories === null ||
    fat_g === null ||
    cholesterol_mg === null ||
    protein_g === null ||
    sugar_g === null ||
    sodium_mg === null ||
    carbs_g === null ||
    fiber_g === null
  ) {
    return null;
  }

  return {
    calories,
    fat_g,
    cholesterol_mg,
    protein_g,
    sugar_g,
    sodium_mg,
    carbs_g,
    fiber_g,
  };
}

function toNutritionNumber(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.round(num * 10) / 10;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toPositiveIntOrNull(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Math.round(num);
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
