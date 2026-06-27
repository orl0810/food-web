import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { buildRecipeImagePrompt } from './prompt.ts';

interface GenerateRecipeImageRequest {
  recipeId: string;
  regenerate?: boolean;
}

interface RecipeIngredientRow {
  name: string;
}

interface RecipeRow {
  id: string;
  user_id: string;
  title: string;
  meal_type: string | null;
  category: string | null;
  tags: string[] | null;
  image_status: string;
  image_version: number | null;
  ingredients?: RecipeIngredientRow[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const defaultImageModel = 'gpt-image-1-mini';
const defaultImageSize = '1024x1024';
const defaultImageQuality = 'medium';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({}, 200);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  let recipeId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'You must be signed in to generate recipe images.' }, 401);
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return jsonResponse({ error: 'Recipe image generation is not configured yet.' }, 500);
    }

    const body = (await req.json()) as GenerateRecipeImageRequest;
    recipeId = body.recipeId?.trim() ?? null;
    if (!recipeId) {
      return jsonResponse({ error: 'recipeId is required.' }, 400);
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'You must be signed in to generate recipe images.' }, 401);
    }

    const userId = userData.user.id;

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('id, user_id, title, meal_type, category, tags, image_status, image_version, ingredients:recipe_ingredients(name)')
      .eq('id', recipeId)
      .eq('is_base_recipe', false)
      .single();

    if (recipeError || !recipe) {
      return jsonResponse({ error: 'Recipe not found.' }, 404);
    }

    const recipeRow = recipe as RecipeRow;

    if (recipeRow.user_id !== userId) {
      return jsonResponse({ error: 'Recipe not found.' }, 404);
    }

    if (recipeRow.image_status === 'completed' && !body.regenerate) {
      return jsonResponse({
        image_status: 'completed',
        message: 'Recipe already has an image.',
      });
    }

    const currentVersion = recipeRow.image_version ?? 1;
    const nextVersion = body.regenerate ? currentVersion + 1 : currentVersion;

    await updateRecipeImage(adminSupabase, recipeId, {
      image_status: 'generating',
      image_error: null,
    });

    const ingredientNames = (recipeRow.ingredients ?? []).map((ingredient) => ingredient.name);
    const prompt = buildRecipeImagePrompt({
      title: recipeRow.title,
      meal_type: recipeRow.meal_type,
      category: recipeRow.category,
      tags: Array.isArray(recipeRow.tags) ? recipeRow.tags : [],
      ingredients: ingredientNames,
    });

    const imageBytes = await generateImage(openAiApiKey, prompt);
    const storageKey = `recipe-images/users/${userId}/${recipeId}/v${nextVersion}.png`;
    const imageUrl = await uploadRecipeImage(adminSupabase, supabaseUrl, storageKey, imageBytes);

    await updateRecipeImage(adminSupabase, recipeId, {
      image_url: imageUrl,
      image_status: 'completed',
      image_prompt: prompt,
      image_provider: 'openai_gpt_image',
      image_storage_provider: 'supabase_storage',
      image_storage_key: storageKey,
      image_generated_at: new Date().toISOString(),
      image_version: nextVersion,
      image_error: null,
    });

    return jsonResponse({
      image_url: imageUrl,
      image_status: 'completed',
    });
  } catch (error) {
    const message = sanitizeError(error);

    if (recipeId) {
      try {
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        if (serviceRoleKey && supabaseUrl) {
          const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
          await updateRecipeImage(adminSupabase, recipeId, {
            image_status: 'failed',
            image_error: message,
          });
        }
      } catch {
        // Ignore secondary update failures.
      }
    }

    return jsonResponse({ error: message }, 502);
  }
});

async function updateRecipeImage(
  supabase: ReturnType<typeof createClient>,
  recipeId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', recipeId)
    .eq('is_base_recipe', false);

  if (error) {
    throw new Error('Could not update recipe image metadata.');
  }
}

async function generateImage(apiKey: string, prompt: string): Promise<Uint8Array> {
  const model = Deno.env.get('OPENAI_IMAGE_MODEL') || defaultImageModel;
  const size = Deno.env.get('OPENAI_IMAGE_SIZE') || defaultImageSize;
  const isGptImageModel = model.startsWith('gpt-image');

  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size,
  };

  if (isGptImageModel) {
    requestBody.quality = Deno.env.get('OPENAI_IMAGE_QUALITY') || defaultImageQuality;
  } else if (model === 'dall-e-2') {
    requestBody.response_format = 'b64_json';
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('OpenAI image generation failed:', response.status, errorBody);
    throw new Error(parseOpenAiError(errorBody, response.status));
  }

  const payload = await response.json();
  const item = payload?.data?.[0];
  const b64 = item?.b64_json;

  if (typeof b64 === 'string' && b64) {
    return decodeBase64(b64);
  }

  const imageUrl = item?.url;
  if (typeof imageUrl === 'string' && imageUrl) {
    return await downloadImage(imageUrl);
  }

  console.error('OpenAI image response missing url/b64_json:', JSON.stringify(payload).slice(0, 500));
  throw new Error('Image generation returned an invalid response.');
}

function parseOpenAiError(errorBody: string, status: number): string {
  try {
    const parsed = JSON.parse(errorBody) as {
      error?: { message?: string; type?: string; code?: string };
    };
    const message = parsed?.error?.message?.trim();
    const type = parsed?.error?.type?.trim();
    const code = parsed?.error?.code?.trim();

    if (message) {
      return message;
    }
    if (type === 'image_generation_user_error') {
      return 'Image generation was blocked. Try simplifying the recipe title or ingredients.';
    }
    if (code) {
      return `OpenAI image generation failed (${code}).`;
    }
  } catch {
    // Fall through to generic message.
  }

  return `Could not generate recipe image right now (OpenAI ${status}).`;
}

async function downloadImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not download generated image.');
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function uploadRecipeImage(
  adminSupabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  storageKey: string,
  body: Uint8Array
): Promise<string> {
  const { error } = await adminSupabase.storage.from('recipe-images').upload(storageKey, body, {
    contentType: 'image/png',
    cacheControl: '31536000',
    upsert: true,
  });

  if (error) {
    console.error('Supabase storage upload failed:', error.message);
    throw new Error(`Could not upload recipe image to storage (${error.message}).`);
  }

  const { data } = adminSupabase.storage.from('recipe-images').getPublicUrl(storageKey);
  const publicUrl = data.publicUrl?.trim();
  if (publicUrl) {
    return publicUrl;
  }

  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/recipe-images/${storageKey}`;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('Missing environment variable')) {
      return 'Recipe image generation is not configured yet.';
    }
    if (error.message.includes('Could not upload recipe image to storage')) {
      return 'Could not store recipe image. Please try again.';
    }
    console.error('generate-recipe-image error:', error.message);
    return error.message;
  }
  return 'Could not generate recipe image right now. Please try again.';
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
