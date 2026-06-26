import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { PutObjectCommand, S3Client } from 'https://esm.sh/@aws-sdk/client-s3@3.679.0';
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

const defaultImageModel = 'dall-e-3';
const defaultImageSize = '1024x1024';

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
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

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

    if (recipeRow.image_status === 'completed' && !body.regenerate) {
      return jsonResponse({
        image_status: 'completed',
        message: 'Recipe already has an image.',
      });
    }

    const currentVersion = recipeRow.image_version ?? 1;
    const nextVersion = body.regenerate ? currentVersion + 1 : currentVersion;

    await updateRecipeImage(supabase, recipeId, {
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
    await uploadToR2(storageKey, imageBytes);

    const publicBaseUrl = normalizeBaseUrl(requireEnv('R2_PUBLIC_BASE_URL'));
    const imageUrl = `${publicBaseUrl}/${storageKey}`;

    await updateRecipeImage(supabase, recipeId, {
      image_url: imageUrl,
      image_status: 'completed',
      image_prompt: prompt,
      image_provider: 'openai_dall_e_3',
      image_storage_provider: 'cloudflare_r2',
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

    if (supabase && recipeId) {
      try {
        await updateRecipeImage(supabase, recipeId, {
          image_status: 'failed',
          image_error: message,
        });
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

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    throw new Error('Could not generate recipe image right now.');
  }

  const payload = await response.json();
  const b64 = payload?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string' || !b64) {
    throw new Error('Image generation returned an invalid response.');
  }

  return decodeBase64(b64);
}

async function uploadToR2(storageKey: string, body: Uint8Array): Promise<void> {
  const accountId = requireEnv('R2_ACCOUNT_ID');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
  const bucketName = requireEnv('R2_BUCKET_NAME');

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      Body: body,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error && error.message.includes('Missing environment variable')) {
    return 'Recipe image generation is not configured yet.';
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
