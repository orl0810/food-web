import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_VISION_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_DAILY_LIMIT = 20;
const PROCESSING_STALE_MS = 2 * 60 * 1000;
const BUCKET = 'meal-analysis-images';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

interface AnalyzeRequestBody {
  analysisId: string;
  mealType?: string;
  eatenAt?: string;
  userContext?: {
    preferredUnits?: 'metric' | 'imperial';
    dietaryPreferences?: string[];
    allergies?: string[];
    dislikedIngredients?: string[];
  };
}

interface MealPhotoAnalysisRow {
  id: string;
  user_id: string;
  storage_path: string;
  status: string;
  normalized_draft: unknown;
  updated_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({}, 200);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.', error_code: 'method_not_allowed' }, 405);
  }

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(
        { error: 'You must be signed in to analyze photos.', error_code: 'unauthenticated' },
        401
      );
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return jsonResponse(
        { error: 'Photo analysis is not configured yet.', error_code: 'provider_unavailable' },
        500
      );
    }

    const body = cleanRequest(await req.json());
    if (!body.analysisId) {
      return jsonResponse({ error: 'Analysis id is required.', error_code: 'invalid_request' }, 400);
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse(
        { error: 'You must be signed in to analyze photos.', error_code: 'unauthenticated' },
        401
      );
    }

    const userId = userData.user.id;

    const { data: analysis, error: analysisError } = await userClient
      .from('meal_photo_analyses')
      .select('id, user_id, storage_path, status, normalized_draft, updated_at')
      .eq('id', body.analysisId)
      .maybeSingle();

    if (analysisError || !analysis) {
      return jsonResponse(
        { error: 'Analysis record not found.', error_code: 'not_found' },
        404
      );
    }

    const row = analysis as MealPhotoAnalysisRow;

    if (row.user_id !== userId) {
      return jsonResponse(
        { error: 'You do not have access to this analysis.', error_code: 'forbidden' },
        403
      );
    }

    if (!isOwnedStoragePath(row.storage_path, userId)) {
      await markFailed(userClient, row.id, 'invalid_storage_path', 'Invalid storage path.');
      return jsonResponse(
        { error: 'Invalid storage path.', error_code: 'invalid_storage_path' },
        400
      );
    }

    if (row.status === 'draft_ready' && row.normalized_draft) {
      return jsonResponse({ draft: row.normalized_draft });
    }

    if (row.status === 'confirmed' && row.normalized_draft) {
      return jsonResponse({ draft: row.normalized_draft });
    }

    if (row.status === 'processing') {
      const updatedAt = Date.parse(row.updated_at);
      if (Number.isFinite(updatedAt) && Date.now() - updatedAt < PROCESSING_STALE_MS) {
        return jsonResponse(
          { error: 'Analysis already in progress.', error_code: 'duplicate_processing' },
          409
        );
      }
    }

    const dailyLimit = Number(Deno.env.get('MAX_DAILY_MEAL_ANALYSES') || DEFAULT_DAILY_LIMIT);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count: todayCount, error: countError } = await userClient
      .from('meal_photo_analyses')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    if (!countError && todayCount !== null && todayCount >= dailyLimit) {
      return jsonResponse(
        { error: 'Daily analysis limit reached.', error_code: 'rate_limited' },
        429
      );
    }

    await userClient
      .from('meal_photo_analyses')
      .update({
        status: 'processing',
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from(BUCKET)
      .download(row.storage_path);

    if (downloadError || !fileData) {
      await markFailed(userClient, row.id, 'storage_read_failed', 'Could not read uploaded image.');
      return jsonResponse(
        { error: 'Could not read uploaded image.', error_code: 'storage_read_failed' },
        502
      );
    }

    const maxBytes = Number(Deno.env.get('MAX_MEAL_IMAGE_BYTES') || DEFAULT_MAX_BYTES);
    if (fileData.size > maxBytes) {
      await markFailed(userClient, row.id, 'image_too_large', 'Image exceeds size limit.');
      return jsonResponse(
        { error: 'The image is too large.', error_code: 'image_too_large' },
        400
      );
    }

    const mimeType = fileData.type || guessMimeFromPath(row.storage_path);
    if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
      await markFailed(userClient, row.id, 'unsupported_mime', 'Unsupported image type.');
      return jsonResponse(
        { error: 'Unsupported image type.', error_code: 'unsupported_mime' },
        400
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const timeoutMs = Number(Deno.env.get('MEAL_ANALYSIS_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let openAiPayload: unknown;
    try {
      const model = Deno.env.get('OPENAI_VISION_MODEL') || DEFAULT_VISION_MODEL;
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            {
              role: 'user',
              content: [
                { type: 'text', text: buildUserPrompt(body) },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        await markFailed(userClient, row.id, 'provider_unavailable', 'AI provider error.');
        return jsonResponse(
          { error: 'Could not analyze photo right now.', error_code: 'provider_unavailable' },
          502
        );
      }

      openAiPayload = await response.json();
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      await markFailed(
        userClient,
        row.id,
        isTimeout ? 'provider_timeout' : 'provider_unavailable',
        isTimeout ? 'Analysis timed out.' : 'AI provider error.'
      );
      return jsonResponse(
        {
          error: isTimeout ? 'Analysis timed out.' : 'Could not analyze photo right now.',
          error_code: isTimeout ? 'provider_timeout' : 'provider_unavailable',
        },
        isTimeout ? 504 : 502
      );
    } finally {
      clearTimeout(timeout);
    }

    const content = (openAiPayload as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content;

    if (!content) {
      await markFailed(userClient, row.id, 'invalid_response', 'Empty AI response.');
      return jsonResponse(
        { error: 'Could not read analysis result.', error_code: 'invalid_response' },
        502
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      await markFailed(userClient, row.id, 'invalid_response', 'Invalid JSON from AI.');
      return jsonResponse(
        { error: 'Could not read analysis result.', error_code: 'invalid_response' },
        502
      );
    }

    const draft = validateDraft(row.id, parsed);
    if (!draft) {
      await markFailed(userClient, row.id, 'no_food_detected', 'No food detected.');
      return jsonResponse(
        { error: 'No food detected in this photo.', error_code: 'no_food_detected' },
        422
      );
    }

    const latencyMs = Date.now() - startedAt;
    const model = Deno.env.get('OPENAI_VISION_MODEL') || DEFAULT_VISION_MODEL;

    await userClient
      .from('meal_photo_analyses')
      .update({
        status: 'draft_ready',
        provider: 'openai',
        model,
        raw_result: parsed,
        normalized_draft: draft,
        overall_confidence: draft.confidence.overall,
        latency_ms: latencyMs,
        image_bytes: fileData.size,
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    console.log(
      JSON.stringify({
        event: 'meal_photo_analysis_completed',
        analysis_id: row.id,
        user_id: userId,
        provider: 'openai',
        model,
        latency_ms: latencyMs,
        image_bytes: fileData.size,
        success: true,
      })
    );

    return jsonResponse({ draft });
  } catch {
    return jsonResponse(
      { error: 'Could not analyze photo right now. Please try again.', error_code: 'internal_error' },
      500
    );
  }
});

function buildSystemPrompt(): string {
  return [
    'You analyze meal photographs and generate editable meal drafts.',
    'Identify only foods that are visible or strongly supported by visual evidence.',
    'Do not invent hidden ingredients.',
    'Estimate portions conservatively.',
    'When quantity, preparation method, or an ingredient cannot be determined, return null or explicitly describe the assumption.',
    'Nutrition values are approximate estimates and must not be represented as medical, laboratory, or exact measurements.',
    'For each detected food return a normalized food name, estimated quantity and unit when reasonably possible, preparation method when visible, confidence between 0 and 1, and plausible alternatives when identification is ambiguous.',
    'Return no more than two clarification questions. Only ask questions whose answers would materially change calories, portions, ingredients, or macronutrients.',
    'Return JSON only with this shape:',
    '{"title":string,"description":string|null,"detectedItems":[{"id":string,"name":string,"estimatedQuantity":number|null,"unit":string|null,"preparation":string|null,"confidence":number,"alternatives":string[]}],"estimatedServing":{"amount":number|null,"unit":string|null},"nutritionEstimate":{"calories":number|null,"protein_g":number|null,"carbohydrates_g":number|null,"fat_g":number|null,"fiber_g":number|null,"sugar_g":number|null},"confidence":{"overall":number,"foodIdentification":number,"portionEstimation":number,"nutritionEstimation":number},"assumptions":string[],"clarificationQuestions":[{"id":string,"question":string,"type":"single-choice"|"number"|"text","options":string[]}],"warnings":string[]}',
    'Do not include markdown or any text outside the JSON response.',
  ].join(' ');
}

function buildUserPrompt(body: AnalyzeRequestBody): string {
  const lines = [
    body.mealType ? `Meal type context: ${body.mealType}` : null,
    body.eatenAt ? `Eaten at: ${body.eatenAt}` : null,
    body.userContext?.preferredUnits
      ? `Preferred units: ${body.userContext.preferredUnits}`
      : null,
    body.userContext?.dietaryPreferences?.length
      ? `Dietary preferences: ${body.userContext.dietaryPreferences.join(', ')}`
      : null,
    body.userContext?.allergies?.length
      ? `Allergies (context only, do not assume presence unless visible): ${body.userContext.allergies.join(', ')}`
      : null,
    body.userContext?.dislikedIngredients?.length
      ? `Disliked ingredients: ${body.userContext.dislikedIngredients.join(', ')}`
      : null,
    'Analyze the attached meal photo and return the JSON draft.',
  ].filter(Boolean);

  return lines.join('\n');
}

function validateDraft(analysisId: string, parsed: Record<string, unknown>): Record<string, unknown> | null {
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  if (!title) {
    return null;
  }

  const rawItems = Array.isArray(parsed.detectedItems) ? parsed.detectedItems : [];
  const detectedItems = rawItems
    .map((item, index) => normalizeDetectedItem(item, index))
    .filter((item): item is Record<string, unknown> => item !== null);

  if (detectedItems.length === 0) {
    return null;
  }

  const serving = isRecord(parsed.estimatedServing) ? parsed.estimatedServing : {};
  const confidenceRaw = isRecord(parsed.confidence) ? parsed.confidence : {};
  const nutritionRaw = isRecord(parsed.nutritionEstimate) ? parsed.nutritionEstimate : {};

  const clarificationRaw = Array.isArray(parsed.clarificationQuestions)
    ? parsed.clarificationQuestions
    : [];
  const clarificationQuestions = clarificationRaw
    .map((q, index) => normalizeClarificationQuestion(q, index))
    .filter((q): q is Record<string, unknown> => q !== null)
    .slice(0, 2);

  return {
    analysisId,
    title,
    description: toStringOrNull(parsed.description),
    detectedItems,
    estimatedServing: {
      amount: toPositiveNumberOrNull(serving.amount),
      unit: toStringOrNull(serving.unit),
    },
    nutritionEstimate: {
      calories: toNutritionNumber(nutritionRaw.calories),
      protein_g: toNutritionNumber(nutritionRaw.protein_g),
      carbohydrates_g: toNutritionNumber(nutritionRaw.carbohydrates_g),
      fat_g: toNutritionNumber(nutritionRaw.fat_g),
      fiber_g: toNutritionNumber(nutritionRaw.fiber_g),
      sugar_g: toNutritionNumber(nutritionRaw.sugar_g),
    },
    confidence: {
      overall: clampConfidence(confidenceRaw.overall),
      foodIdentification: clampConfidence(confidenceRaw.foodIdentification),
      portionEstimation: clampConfidence(confidenceRaw.portionEstimation),
      nutritionEstimation: clampConfidence(confidenceRaw.nutritionEstimation),
    },
    assumptions: toStringArray(parsed.assumptions),
    clarificationQuestions,
    warnings: toStringArray(parsed.warnings),
  };
}

function normalizeDetectedItem(raw: unknown, index: number): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    return null;
  }
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `item-${index + 1}`,
    name,
    estimatedQuantity: toPositiveNumberOrNull(raw.estimatedQuantity ?? raw.quantity),
    unit: toStringOrNull(raw.unit),
    preparation: toStringOrNull(raw.preparation),
    confidence: clampConfidence(raw.confidence),
    alternatives: toStringArray(raw.alternatives).slice(0, 5),
    userModified: false,
  };
}

function normalizeClarificationQuestion(raw: unknown, index: number): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }
  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (!question) {
    return null;
  }
  const type =
    raw.type === 'single-choice' || raw.type === 'number' || raw.type === 'text'
      ? raw.type
      : 'text';
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : `q-${index + 1}`,
    question,
    type,
    options: toStringArray(raw.options),
  };
}

async function markFailed(
  client: ReturnType<typeof createClient>,
  analysisId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await client
    .from('meal_photo_analyses')
    .update({
      status: 'failed',
      error_code: errorCode,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', analysisId);
}

function cleanRequest(input: unknown): AnalyzeRequestBody {
  const body = isRecord(input) ? input : {};
  return {
    analysisId: typeof body.analysisId === 'string' ? body.analysisId.trim() : '',
    mealType: typeof body.mealType === 'string' ? body.mealType : undefined,
    eatenAt: typeof body.eatenAt === 'string' ? body.eatenAt : undefined,
    userContext: isRecord(body.userContext)
      ? {
          preferredUnits:
            body.userContext.preferredUnits === 'metric' ||
            body.userContext.preferredUnits === 'imperial'
              ? body.userContext.preferredUnits
              : undefined,
          dietaryPreferences: toStringArray(body.userContext.dietaryPreferences),
          allergies: toStringArray(body.userContext.allergies),
          dislikedIngredients: toStringArray(body.userContext.dislikedIngredients),
        }
      : undefined,
  };
}

function isOwnedStoragePath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`);
}

function guessMimeFromPath(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function clampConfidence(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.max(0, Math.min(1, num));
}

function toPositiveNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

function toNutritionNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.round(num * 10) / 10;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
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

// Exported for future unit tests (deno test)
export { validateDraft, normalizeDetectedItem, clampConfidence };
