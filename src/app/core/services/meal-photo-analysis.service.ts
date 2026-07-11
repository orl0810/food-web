import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  AnalyzeMealPhotoRequest,
  AnalyzeMealPhotoResponse,
  MealPhotoAnalysisRecord,
  MealPhotoDraft,
} from '../models/meal-photo-analysis.model';
import { MealType } from '../models/meal-plan.model';
import { mapAnalysisError } from '../../shared/utils/meal-photo-draft.utils';
import { AuthService } from './auth.service';
import { FoodLogPhotoService } from './food-log-photo.service';
import { SupabaseService } from './supabase.service';

const ANALYSIS_BUCKET = 'meal-analysis-images';

interface AnalyzeMealPhotoErrorBody {
  error?: string;
  error_code?: string;
}

export interface CreateAnalysisResult {
  analysisId: string;
  storagePath: string;
  optimizedFile: File;
}

export interface AnalyzePhotoResult {
  draft: MealPhotoDraft | null;
  error: string | null;
  errorCode: string | null;
}

@Injectable({ providedIn: 'root' })
export class MealPhotoAnalysisService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly photoService = inject(FoodLogPhotoService);

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly stepSignal = signal<'idle' | 'uploading' | 'analyzing'>('idle');

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly step = this.stepSignal.asReadonly();

  isAvailable(): boolean {
    return !environment.useLocalApi;
  }

  async createAnalysis(file: File): Promise<CreateAnalysisResult> {
    if (!this.isAvailable()) {
      throw new Error('Photo analysis requires Supabase mode.');
    }

    const client = this.requireClient();
    const userId = this.requireUserId();
    const optimized = await this.photoService.optimizeImage(file);
    const analysisId = crypto.randomUUID();
    const extension = this.getExtension(optimized);
    const storagePath = `${userId}/${analysisId}/original${extension}`;

    this.stepSignal.set('uploading');
    this.errorSignal.set(null);

    const { error: uploadError } = await client.storage
      .from(ANALYSIS_BUCKET)
      .upload(storagePath, optimized, {
        cacheControl: '3600',
        upsert: false,
        contentType: optimized.type || undefined,
      });

    if (uploadError) {
      this.stepSignal.set('idle');
      throw new Error('Photo upload failed. Please try another image.');
    }

    const { error: insertError } = await client.from('meal_photo_analyses').insert({
      id: analysisId,
      user_id: userId,
      storage_path: storagePath,
      status: 'uploaded',
      image_bytes: optimized.size,
    });

    if (insertError) {
      this.stepSignal.set('idle');
      throw new Error('Could not start photo analysis. Please try again.');
    }

    return { analysisId, storagePath, optimizedFile: optimized };
  }

  async analyze(
    analysisId: string,
    context: { mealType?: MealType; eatenAt?: string } = {}
  ): Promise<AnalyzePhotoResult> {
    if (!this.isAvailable()) {
      return {
        draft: null,
        error: 'Photo analysis requires Supabase mode.',
        errorCode: 'local_api',
      };
    }

    this.loadingSignal.set(true);
    this.stepSignal.set('analyzing');
    this.errorSignal.set(null);

    try {
      const client = this.requireClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('You must be signed in to analyze photos.');
      }

      const request: AnalyzeMealPhotoRequest = {
        analysisId,
        mealType: context.mealType,
        eatenAt: context.eatenAt,
      };

      const supabaseUrl = environment.supabaseUrl;
      const anonKey = environment.supabaseAnonKey;
      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-meal-photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      let payload: (AnalyzeMealPhotoResponse & AnalyzeMealPhotoErrorBody) | null = null;
      try {
        payload = (await response.json()) as AnalyzeMealPhotoResponse & AnalyzeMealPhotoErrorBody;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        return {
          draft: null,
          error: mapAnalysisError(payload?.error_code ?? null, payload?.error ?? null),
          errorCode: payload?.error_code ?? 'analysis_failed',
        };
      }

      if (payload?.error) {
        return {
          draft: null,
          error: mapAnalysisError(payload.error_code ?? null, payload.error),
          errorCode: payload.error_code ?? 'analysis_failed',
        };
      }

      if (!payload?.draft) {
        return {
          draft: null,
          error: 'Could not analyze this photo. Please try again.',
          errorCode: 'invalid_response',
        };
      }

      return { draft: payload.draft, error: null, errorCode: null };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not analyze this photo. Please try again.';
      this.errorSignal.set(message);
      return { draft: null, error: message, errorCode: 'analysis_failed' };
    } finally {
      this.loadingSignal.set(false);
      this.stepSignal.set('idle');
    }
  }

  async uploadAndAnalyze(
    file: File,
    context: { mealType?: MealType; eatenAt?: string } = {}
  ): Promise<AnalyzePhotoResult & { analysisId: string; optimizedFile: File }> {
    const created = await this.createAnalysis(file);
    const result = await this.analyze(created.analysisId, context);
    return {
      ...result,
      analysisId: created.analysisId,
      optimizedFile: created.optimizedFile,
    };
  }

  async markConfirmed(analysisId: string, confirmedPayload: Record<string, unknown>): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const client = this.requireClient();
    await client
      .from('meal_photo_analyses')
      .update({
        status: 'confirmed',
        confirmed_payload: confirmedPayload,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
  }

  async getAnalysisRecord(analysisId: string): Promise<MealPhotoAnalysisRecord | null> {
    const client = this.requireClient();
    const { data, error } = await client
      .from('meal_photo_analyses')
      .select('*')
      .eq('id', analysisId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as MealPhotoAnalysisRecord;
  }

  private requireClient() {
    const client = this.supabaseService.getClient();
    if (!client) {
      throw new Error('Photo analysis is only available in the browser.');
    }
    return client;
  }

  private requireUserId(): string {
    const userId = this.authService.user()?.id;
    if (!userId) {
      throw new Error('You must be signed in to analyze photos.');
    }
    return userId;
  }

  private getExtension(file: File): string {
    const fromName = file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
    if (fromName) {
      return fromName;
    }
    if (file.type === 'image/png') return '.png';
    if (file.type === 'image/webp') return '.webp';
    if (file.type === 'image/heic' || file.type === 'image/heif') return '.heic';
    return '.jpg';
  }
}
