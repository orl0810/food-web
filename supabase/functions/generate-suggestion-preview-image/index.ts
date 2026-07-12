import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import { buildRecipeImagePrompt } from '../generate-recipe-image/prompt.ts';

interface GenerateSuggestionPreviewImageRequest {
  title: string;
  mealType?: string | null;
  tags?: string[];
  ingredients?: string[];
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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'You must be signed in to generate preview images.' }, 401);
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return jsonResponse({ error: 'Recipe image generation is not configured yet.' }, 500);
    }

    const body = (await req.json()) as GenerateSuggestionPreviewImageRequest;
    const title = body.title?.trim();
    if (!title) {
      return jsonResponse({ error: 'title is required.' }, 400);
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'You must be signed in to generate preview images.' }, 401);
    }

    const userId = userData.user.id;
    const ingredientNames = normalizeStringArray(body.ingredients).slice(0, 8);
    const tags = normalizeStringArray(body.tags).slice(0, 6);

    const prompt = buildRecipeImagePrompt({
      title,
      meal_type: toNonEmptyString(body.mealType),
      category: null,
      tags,
      ingredients: ingredientNames,
    });

    const imageBytes = await generateImage(openAiApiKey, prompt);
    const previewId = crypto.randomUUID();
    const storageKey = `recipe-images/previews/${userId}/${previewId}.png`;
    const previewImageUrl = await uploadPreviewImage(
      adminSupabase,
      supabaseUrl,
      storageKey,
      imageBytes
    );

    return jsonResponse({ previewImageUrl });
  } catch (error) {
    const message = sanitizeError(error);
    return jsonResponse({ error: message }, 502);
  }
});

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
    console.error('OpenAI preview image generation failed:', response.status, errorBody);
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

  throw new Error('Image generation returned an invalid response.');
}

function parseOpenAiError(errorBody: string, status: number): string {
  try {
    const parsed = JSON.parse(errorBody) as {
      error?: { message?: string; type?: string; code?: string };
    };
    const message = parsed?.error?.message?.trim();
    if (message) {
      return message;
    }
  } catch {
    // Fall through.
  }

  return `Could not generate preview image right now (OpenAI ${status}).`;
}

async function downloadImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not download generated image.');
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function uploadPreviewImage(
  adminSupabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  storageKey: string,
  body: Uint8Array
): Promise<string> {
  const { error } = await adminSupabase.storage.from('recipe-images').upload(storageKey, body, {
    contentType: 'image/png',
    cacheControl: '86400',
    upsert: false,
  });

  if (error) {
    console.error('Supabase preview storage upload failed:', error.message);
    throw new Error(`Could not upload preview image to storage (${error.message}).`);
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

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('Missing environment variable')) {
      return 'Recipe image generation is not configured yet.';
    }
    console.error('generate-suggestion-preview-image error:', error.message);
    return error.message;
  }
  return 'Could not generate preview image right now. Please try again.';
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
