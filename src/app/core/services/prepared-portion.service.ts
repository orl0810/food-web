import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  PreparedPortion,
  PreparedPortionFilter,
  PreparedPortionInput,
} from '../models/prepared-portion.model';
import {
  derivePreparedPortionStatus,
  filterPreparedPortions,
} from '../../shared/utils/prepared-portion.utils';
import { isExpired, isExpiringSoon } from '../../shared/utils/expiration.utils';
import { toISODate } from '../../shared/utils/meal-plan.utils';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

const PREPARED_PORTION_SELECT =
  '*, recipe:recipes(id, title)';

@Injectable({ providedIn: 'root' })
export class PreparedPortionService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);

  private readonly portionsSignal = signal<PreparedPortion[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly portions = this.portionsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly availablePortions = computed(() =>
    this.portionsSignal().filter(
      (p) => p.status === 'available' && p.available_portions > 0
    )
  );

  readonly expiringSoonPortions = computed(() =>
    this.portionsSignal().filter(
      (p) =>
        p.available_portions > 0 &&
        p.expires_at &&
        isExpiringSoon(p.expires_at, 3) &&
        !isExpired(p.expires_at)
    )
  );

  readonly useFirstPortions = computed(() =>
    [...this.portionsSignal()]
      .filter(
        (p) =>
          p.available_portions > 0 &&
          p.status !== 'finished' &&
          (!p.expires_at || !isExpired(p.expires_at))
      )
      .sort((a, b) => (a.expires_at ?? '9999').localeCompare(b.expires_at ?? '9999'))
      .slice(0, 5)
  );

  filterPortions(items: PreparedPortion[], filter: PreparedPortionFilter): PreparedPortion[] {
    return filterPreparedPortions(items, filter);
  }

  async loadPortions(): Promise<void> {
    if (environment.useLocalApi) {
      return this.loadPortionsLocal();
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const { data, error } = await client
      .from('prepared_portions')
      .select(PREPARED_PORTION_SELECT)
      .eq('user_id', userId)
      .order('expires_at', { ascending: true, nullsFirst: false });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set('Could not load ready portions. Please try again.');
      return;
    }

    this.portionsSignal.set(this.normalizePortions(data));
  }

  async createPortion(
    input: PreparedPortionInput
  ): Promise<{ portion: PreparedPortion | null; error: string | null }> {
    const payload = this.sanitizeInput(input);

    if (environment.useLocalApi) {
      return this.createPortionLocal(payload);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { portion: null, error: 'You must be signed in.' };
    }

    this.errorSignal.set(null);

    const { data, error } = await client
      .from('prepared_portions')
      .insert({
        user_id: userId,
        ...payload,
        available_portions: payload.total_portions,
        status: 'available',
        updated_at: new Date().toISOString(),
      })
      .select(PREPARED_PORTION_SELECT)
      .single();

    if (error) {
      return { portion: null, error: 'Could not create ready portion. Please try again.' };
    }

    const portion = this.normalizePortion(data);
    this.portionsSignal.update((items) => [...items, portion]);
    return { portion, error: null };
  }

  async createFromRecipe(
    recipeId: string,
    name: string,
    totalPortions: number,
    options?: {
      cooked_at?: string;
      expires_at?: string | null;
      storage_location?: PreparedPortionInput['storage_location'];
      notes?: string | null;
    }
  ): Promise<{ portion: PreparedPortion | null; error: string | null }> {
    return this.createPortion({
      name,
      source_type: 'recipe',
      recipe_id: recipeId,
      total_portions: totalPortions,
      cooked_at: options?.cooked_at ?? toISODate(new Date()),
      expires_at: options?.expires_at ?? null,
      storage_location: options?.storage_location ?? 'fridge',
      notes: options?.notes ?? null,
    });
  }

  async updatePortion(
    id: string,
    updates: Partial<PreparedPortionInput> & { total_portions?: number }
  ): Promise<{ error: string | null }> {
    const existing = this.portionsSignal().find((p) => p.id === id);
    if (!existing) {
      return { error: 'Portion not found.' };
    }

    if (updates.total_portions !== undefined) {
      const used = existing.total_portions - existing.available_portions;
      if (updates.total_portions < used) {
        return {
          error: `Cannot set total below ${used} (already used).`,
        };
      }
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) payload['name'] = updates.name.trim();
    if (updates.total_portions !== undefined) {
      payload['total_portions'] = updates.total_portions;
      const used = existing.total_portions - existing.available_portions;
      payload['available_portions'] = updates.total_portions - used;
    }
    if (updates.cooked_at !== undefined) payload['cooked_at'] = updates.cooked_at;
    if (updates.expires_at !== undefined) payload['expires_at'] = updates.expires_at;
    if (updates.storage_location !== undefined) payload['storage_location'] = updates.storage_location;
    if (updates.notes !== undefined) payload['notes'] = updates.notes?.trim() || null;

    if (environment.useLocalApi) {
      return this.updatePortionLocal(id, payload);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in.' };
    }

    const { data, error } = await client
      .from('prepared_portions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select(PREPARED_PORTION_SELECT)
      .single();

    if (error) {
      return { error: 'Could not update ready portion. Please try again.' };
    }

    const portion = this.normalizePortion(data);
    this.portionsSignal.update((items) =>
      items.map((item) => (item.id === id ? portion : item))
    );
    return { error: null };
  }

  async deletePortion(id: string): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.deletePortionLocal(id);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in.' };
    }

    const { error } = await client
      .from('prepared_portions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return { error: 'Could not delete ready portion. Please try again.' };
    }

    this.portionsSignal.update((items) => items.filter((item) => item.id !== id));
    return { error: null };
  }

  async assignPortions(
    portionId: string,
    portionsUsed: number,
    allowExpired = false
  ): Promise<{ error: string | null }> {
    const portion = this.portionsSignal().find((p) => p.id === portionId);
    if (!portion) {
      return { error: 'Portion not found.' };
    }

    if (portionsUsed > portion.available_portions) {
      return {
        error: `Only ${portion.available_portions} portion${portion.available_portions === 1 ? '' : 's'} available.`,
      };
    }

    if (
      !allowExpired &&
      portion.expires_at &&
      isExpired(portion.expires_at)
    ) {
      return { error: 'This portion has expired. Confirm to use anyway.' };
    }

    const newAvailable = portion.available_portions - portionsUsed;
    const status = derivePreparedPortionStatus({
      available_portions: newAvailable,
      expires_at: portion.expires_at,
      status: portion.status,
    });

    return this.updatePortionCounts(portionId, newAvailable, status);
  }

  async releasePortions(
    portionId: string,
    portionsUsed: number
  ): Promise<{ error: string | null }> {
    const portion = this.portionsSignal().find((p) => p.id === portionId);
    if (!portion) {
      return { error: 'Portion not found.' };
    }

    const newAvailable = Math.min(
      portion.total_portions,
      portion.available_portions + portionsUsed
    );
    const status = derivePreparedPortionStatus({
      available_portions: newAvailable,
      expires_at: portion.expires_at,
      status: portion.status,
    });

    return this.updatePortionCounts(portionId, newAvailable, status);
  }

  async markAsEaten(
    portionId: string,
    count = 1
  ): Promise<{ error: string | null }> {
    return this.assignPortions(portionId, count, true);
  }

  async moveToFreezer(portionId: string): Promise<{ error: string | null }> {
    return this.updatePortion(portionId, { storage_location: 'freezer' });
  }

  getPortionById(id: string): PreparedPortion | undefined {
    return this.portionsSignal().find((p) => p.id === id);
  }

  refreshStatusesInMemory(): void {
    this.portionsSignal.update((items) =>
      items.map((item) => ({
        ...item,
        status: derivePreparedPortionStatus(item),
      }))
    );
  }

  private async updatePortionCounts(
    id: string,
    availablePortions: number,
    status: PreparedPortion['status']
  ): Promise<{ error: string | null }> {
    const payload = {
      available_portions: availablePortions,
      status,
      updated_at: new Date().toISOString(),
    };

    if (environment.useLocalApi) {
      return this.updatePortionLocal(id, payload);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in.' };
    }

    const { data, error } = await client
      .from('prepared_portions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select(PREPARED_PORTION_SELECT)
      .single();

    if (error) {
      return { error: 'Could not update portion count. Please try again.' };
    }

    const portion = this.normalizePortion(data);
    this.portionsSignal.update((items) =>
      items.map((item) => (item.id === id ? portion : item))
    );
    return { error: null };
  }

  private sanitizeInput(input: PreparedPortionInput): PreparedPortionInput & { total_portions: number } {
    return {
      name: input.name.trim(),
      source_type: input.source_type,
      recipe_id: input.recipe_id ?? null,
      total_portions: Math.max(1, Math.trunc(input.total_portions)),
      cooked_at: input.cooked_at ?? toISODate(new Date()),
      expires_at: input.expires_at ?? null,
      storage_location: input.storage_location ?? 'fridge',
      notes: input.notes?.trim() || null,
    };
  }

  private async loadPortionsLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.getPreparedPortions();
      this.portionsSignal.set(this.normalizePortions(data));
    } catch {
      this.errorSignal.set('Could not load ready portions. Please try again.');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async createPortionLocal(
    payload: PreparedPortionInput & { total_portions: number }
  ): Promise<{ portion: PreparedPortion | null; error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { portion: null, error: 'You must be signed in.' };
    }

    try {
      const data = await this.localApiService.createPreparedPortion({
        ...payload,
        available_portions: payload.total_portions,
        status: 'available',
      });
      const portion = this.normalizePortion(data);
      this.portionsSignal.update((items) => [...items, portion]);
      return { portion, error: null };
    } catch {
      return { portion: null, error: 'Could not create ready portion. Please try again.' };
    }
  }

  private async updatePortionLocal(
    id: string,
    payload: Record<string, unknown>
  ): Promise<{ error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { error: 'You must be signed in.' };
    }

    try {
      const data = await this.localApiService.updatePreparedPortion(id, payload);
      const portion = this.normalizePortion(data);
      this.portionsSignal.update((items) =>
        items.map((item) => (item.id === id ? portion : item))
      );
      return { error: null };
    } catch {
      return { error: 'Could not update ready portion. Please try again.' };
    }
  }

  private async deletePortionLocal(id: string): Promise<{ error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { error: 'You must be signed in.' };
    }

    try {
      await this.localApiService.deletePreparedPortion(id);
      this.portionsSignal.update((items) => items.filter((item) => item.id !== id));
      return { error: null };
    } catch {
      return { error: 'Could not delete ready portion. Please try again.' };
    }
  }

  private normalizePortions(data: unknown): PreparedPortion[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((row) => this.normalizePortion(row));
  }

  private normalizePortion(row: unknown): PreparedPortion {
    const portion = row as PreparedPortion & {
      recipe?: { id: string; title: string } | { id: string; title: string }[] | null;
    };
    const recipeData = Array.isArray(portion.recipe) ? portion.recipe[0] : portion.recipe;

    const normalized: PreparedPortion = {
      ...portion,
      total_portions: Number(portion.total_portions),
      available_portions: Number(portion.available_portions),
      recipe: recipeData ?? undefined,
      status: derivePreparedPortionStatus(portion),
    };

    return normalized;
  }
}
