import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AppFeedbackInsert } from '../models/app-feedback.model';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);

  private readonly submittingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly submitting = this.submittingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  async submitFeedback(input: AppFeedbackInsert): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.submitFeedbackLocal(input);
    }
    return this.submitFeedbackSupabase(input);
  }

  private async submitFeedbackLocal(input: AppFeedbackInsert): Promise<{ error: string | null }> {
    this.submittingSignal.set(true);
    this.errorSignal.set(null);

    try {
      await this.localApiService.submitFeedback({
        rating: input.rating,
        comment: input.comment?.trim() || null,
        appContext: input.app_context ?? null,
      });
      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit feedback.';
      this.errorSignal.set(message);
      return { error: message };
    } finally {
      this.submittingSignal.set(false);
    }
  }

  private async submitFeedbackSupabase(input: AppFeedbackInsert): Promise<{ error: string | null }> {
    const client = this.supabaseService.getClient();
    if (!client) {
      const message = 'Unable to submit feedback right now.';
      this.errorSignal.set(message);
      return { error: message };
    }

    const userId = this.authService.user()?.id;
    if (!userId) {
      const message = 'You must be signed in to submit feedback.';
      this.errorSignal.set(message);
      return { error: message };
    }

    this.submittingSignal.set(true);
    this.errorSignal.set(null);

    const { error } = await client.from('app_feedback').insert({
      user_id: userId,
      rating: input.rating,
      comment: input.comment?.trim() || null,
      app_context: input.app_context ?? null,
    });

    this.submittingSignal.set(false);

    if (error) {
      this.errorSignal.set(error.message);
      return { error: error.message };
    }

    return { error: null };
  }
}
