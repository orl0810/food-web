#!/usr/bin/env node
/**
 * Backfills nutrition and image metadata for user recipes stuck in pending state.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_BASE_URL
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... \
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
 *   R2_BUCKET_NAME=foodweb R2_PUBLIC_BASE_URL=https://cdk.orlando-photo.com \
 *   node scripts/backfill-recipe-metadata.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';
const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function toNutritionNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.round(num * 10) / 10;
}

function buildNutritionPrompt(recipe, ingredients) {
  const portions = recipe.portions && recipe.portions > 0 ? recipe.portions : 4;
  const ingredientLines = ingredients
    .map((ingredient) => {
      const quantity =
        ingredient.quantity !== null && ingredient.quantity !== undefined
          ? `${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ''}`
          : 'unspecified amount';
      return `- ${ingredient.name}: ${quantity}`;
    })
    .join('\n');

  return [
    `Recipe title: ${recipe.title}`,
    recipe.description ? `Description: ${recipe.description}` : null,
    `Portions: ${portions}`,
    'Ingredients:',
    ingredientLines,
    '',
    `Estimate nutrition for ONE portion (1 of ${portions} servings).`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildImagePrompt(recipe, ingredientNames) {
  const parts = [`A photo of "${recipe.title.trim()}".`];
  if (recipe.meal_type) {
    parts.push(`Meal type: ${recipe.meal_type}.`);
  }
  if (recipe.category) {
    parts.push(`Category: ${recipe.category}.`);
  }
  if (ingredientNames.length > 0) {
    parts.push(`Main ingredients: ${ingredientNames.slice(0, 5).join(', ')}.`);
  }
  parts.push(
    'Realistic premium food photography, warm natural daylight, cream background, soft shadows, clean minimalist styling.'
  );
  return parts.join(' ');
}

async function estimateNutrition(openAiApiKey, recipe, ingredients) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Estimate per-portion nutrition. Return JSON only: {"nutrition":{"calories":number,"fat_g":number,"cholesterol_mg":number,"protein_g":number,"sugar_g":number,"sodium_mg":number,"carbs_g":number,"fiber_g":number}}',
        },
        {
          role: 'user',
          content: buildNutritionPrompt(recipe, ingredients),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI nutrition request failed (${response.status})`);
  }

  const payload = await response.json();
  const parsed = JSON.parse(payload?.choices?.[0]?.message?.content ?? '{}');
  const nutrition = parsed.nutrition ?? parsed;
  const values = {
    calories: toNutritionNumber(nutrition.calories),
    fat_g: toNutritionNumber(nutrition.fat_g),
    cholesterol_mg: toNutritionNumber(nutrition.cholesterol_mg),
    protein_g: toNutritionNumber(nutrition.protein_g),
    sugar_g: toNutritionNumber(nutrition.sugar_g),
    sodium_mg: toNutritionNumber(nutrition.sodium_mg),
    carbs_g: toNutritionNumber(nutrition.carbs_g),
    fiber_g: toNutritionNumber(nutrition.fiber_g),
  };

  if (Object.values(values).some((value) => value === null)) {
    throw new Error('OpenAI returned incomplete nutrition values');
  }

  return values;
}

async function generateImage(openAiApiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      n: 1,
      size: OPENAI_IMAGE_SIZE,
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI image request failed (${response.status})`);
  }

  const payload = await response.json();
  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI image response missing image data');
  }

  return Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
}

async function uploadToR2(storageKey, body, r2Config) {
  const client = new AwsClient({
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
    service: 's3',
    region: 'auto',
  });

  const url = `https://${r2Config.accountId}.r2.cloudflarestorage.com/${r2Config.bucketName}/${storageKey}`;
  const response = await client.fetch(url, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed (${response.status})`);
  }
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const openAiApiKey = requireEnv('OPENAI_API_KEY');
  const r2Config = {
    accountId: requireEnv('R2_ACCOUNT_ID'),
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    bucketName: requireEnv('R2_BUCKET_NAME'),
    publicBaseUrl: requireEnv('R2_PUBLIC_BASE_URL').replace(/\/+$/, ''),
  };

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select(
      'id, user_id, title, description, portions, meal_type, category, tags, image_status, nutrition_calories, ingredients:recipe_ingredients(name, quantity, unit)'
    )
    .eq('is_base_recipe', false)
    .or('image_status.eq.pending,nutrition_calories.is.null')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  console.log(`Found ${recipes?.length ?? 0} recipes to backfill.`);

  for (const recipe of recipes ?? []) {
    const ingredients = (recipe.ingredients ?? []).filter((item) => item.name?.trim());
    console.log(`\nProcessing: ${recipe.title} (${recipe.id})`);

    if (recipe.nutrition_calories === null && ingredients.length > 0) {
      try {
        const nutrition = await estimateNutrition(openAiApiKey, recipe, ingredients);
        const { error: nutritionError } = await supabase
          .from('recipes')
          .update({
            nutrition_calories: nutrition.calories,
            nutrition_fat_g: nutrition.fat_g,
            nutrition_cholesterol_mg: nutrition.cholesterol_mg,
            nutrition_protein_g: nutrition.protein_g,
            nutrition_sugar_g: nutrition.sugar_g,
            nutrition_sodium_mg: nutrition.sodium_mg,
            nutrition_carbs_g: nutrition.carbs_g,
            nutrition_fiber_g: nutrition.fiber_g,
            nutrition_calculated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipe.id);

        if (nutritionError) {
          throw nutritionError;
        }

        console.log('  nutrition: updated');
      } catch (nutritionError) {
        console.error('  nutrition: failed', nutritionError.message);
      }
    } else {
      console.log('  nutrition: skipped');
    }

    if (recipe.image_status === 'pending') {
      try {
        await supabase
          .from('recipes')
          .update({ image_status: 'generating', image_error: null, updated_at: new Date().toISOString() })
          .eq('id', recipe.id);

        const ingredientNames = ingredients.map((item) => item.name.trim());
        const prompt = buildImagePrompt(recipe, ingredientNames);
        const imageBytes = await generateImage(openAiApiKey, prompt);
        const storageKey = `recipe-images/users/${recipe.user_id}/${recipe.id}/v1.png`;
        await uploadToR2(storageKey, imageBytes, r2Config);
        const imageUrl = `${r2Config.publicBaseUrl}/${storageKey}`;

        const { error: imageError } = await supabase
          .from('recipes')
          .update({
            image_url: imageUrl,
            image_status: 'completed',
            image_prompt: prompt,
            image_provider: 'openai_dall_e_3',
            image_storage_provider: 'cloudflare_r2',
            image_storage_key: storageKey,
            image_generated_at: new Date().toISOString(),
            image_version: 1,
            image_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipe.id);

        if (imageError) {
          throw imageError;
        }

        console.log('  image: updated');
      } catch (imageError) {
        console.error('  image: failed', imageError.message);
        await supabase
          .from('recipes')
          .update({
            image_status: 'failed',
            image_error: imageError.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipe.id);
      }
    } else {
      console.log('  image: skipped');
    }
  }

  console.log('\nBackfill complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
