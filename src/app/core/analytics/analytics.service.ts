import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ProductEventName, ProductEventProperties } from './analytics-events';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);

  async track(event: ProductEventName, properties: ProductEventProperties = {}): Promise<void> {
    if (environment.useLocalApi) {
      return;
    }

    try {
      const userId = this.authService.user()?.id;
      if (!userId) {
        return;
      }

      const client = this.supabaseService.getClient();
      if (!client) {
        return;
      }

      const { error } = await client.from('product_events').insert({
        user_id: userId,
        event_name: event,
        properties: this.sanitizeProperties(properties),
      });

      if (error && !environment.production) {
        console.warn('[Analytics] Failed to track event:', event, error.message);
      }
    } catch (error) {
      if (!environment.production) {
        const message = error instanceof Error ? error.message : 'Unknown analytics error';
        console.warn('[Analytics] Failed to track event:', event, message);
      }
    }
  }

  private sanitizeProperties(properties: ProductEventProperties): ProductEventProperties {
    const sanitized: ProductEventProperties = {};

    if (properties.source) {
      sanitized.source = properties.source.slice(0, 120);
    }
    if (properties.method) {
      sanitized.method = properties.method.slice(0, 80);
    }
    if (properties.failure_stage) {
      sanitized.failure_stage = properties.failure_stage.slice(0, 80);
    }
    if (properties.error_code) {
      sanitized.error_code = properties.error_code.slice(0, 80);
    }
    if (typeof properties.duration_ms === 'number' && Number.isFinite(properties.duration_ms)) {
      sanitized.duration_ms = Math.max(0, Math.round(properties.duration_ms));
    }

    return sanitized;
  }
}
