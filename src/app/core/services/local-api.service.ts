import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AppUser } from '../models/auth-user.model';

const TOKEN_STORAGE_KEY = 'pantryflow_local_token';
const USER_STORAGE_KEY = 'pantryflow_local_user';

interface LocalAuthResponse {
  user: AppUser;
  access_token: string;
}

interface ApiErrorResponse {
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class LocalApiService {
  private readonly platformId = inject(PLATFORM_ID);

  isEnabled(): boolean {
    return environment.useLocalApi && isPlatformBrowser(this.platformId);
  }

  getStoredSession(): { user: AppUser; accessToken: string } | null {
    if (!this.isEnabled()) {
      return null;
    }

    const accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const userRaw = localStorage.getItem(USER_STORAGE_KEY);

    if (!accessToken || !userRaw) {
      return null;
    }

    try {
      return { user: JSON.parse(userRaw) as AppUser, accessToken };
    } catch {
      this.clearStoredSession();
      return null;
    }
  }

  storeSession(user: AppUser, accessToken: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  clearStoredSession(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  async signUp(email: string, password: string): Promise<{ user: AppUser; accessToken: string }> {
    const response = await this.request<LocalAuthResponse>('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.storeSession(response.user, response.access_token);
    return { user: response.user, accessToken: response.access_token };
  }

  async signIn(email: string, password: string): Promise<{ user: AppUser; accessToken: string }> {
    const response = await this.request<LocalAuthResponse>('/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.storeSession(response.user, response.access_token);
    return { user: response.user, accessToken: response.access_token };
  }

  async getCurrentUser(): Promise<AppUser | null> {
    const session = this.getStoredSession();
    if (!session) {
      return null;
    }

    try {
      const response = await this.request<{ user: AppUser }>('/auth/me', {
        method: 'GET',
        token: session.accessToken,
      });
      return response.user;
    } catch {
      this.clearStoredSession();
      return null;
    }
  }

  async getFoodItems(): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>('/food-items', {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async createFoodItem(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/food-items', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async updateFoodItem(id: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>(`/food-items/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async deleteFoodItem(id: string): Promise<void> {
    await this.request<void>(`/food-items/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  async getRecipes(): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>('/recipes', {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async getRecipe(id: string): Promise<unknown> {
    const response = await this.request<{ data: unknown }>(`/recipes/${id}`, {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async createRecipe(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/recipes', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async updateRecipe(id: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>(`/recipes/${id}`, {
      method: 'PUT',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async deleteRecipe(id: string): Promise<void> {
    await this.request<void>(`/recipes/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  async getMealPlanItems(start: string, end: string): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>(
      `/meal-plan-items?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      {
        method: 'GET',
        auth: true,
      }
    );
    return response.data;
  }

  async getTodayMealPlanItems(): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>('/meal-plan-items/today', {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async createMealPlanItem(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/meal-plan-items', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async updateMealPlanItem(id: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>(`/meal-plan-items/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async deleteMealPlanItem(id: string): Promise<void> {
    await this.request<void>(`/meal-plan-items/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  async duplicateMealPlanWeek(targetWeekStart: string): Promise<{ copiedCount: number }> {
    const response = await this.request<{ data: { copiedCount: number } }>(
      '/meal-plan-items/duplicate-week',
      {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ targetWeekStart }),
      }
    );
    return response.data;
  }

  async getPreparedPortions(): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>('/prepared-portions', {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async createPreparedPortion(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/prepared-portions', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async updatePreparedPortion(id: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>(`/prepared-portions/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async deletePreparedPortion(id: string): Promise<void> {
    await this.request<void>(`/prepared-portions/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  /** @deprecated Use getMealPlanItems */
  async getMealPlan(start: string, end: string): Promise<unknown[]> {
    return this.getMealPlanItems(start, end);
  }

  /** @deprecated Use getTodayMealPlanItems */
  async getTodayMeals(): Promise<unknown[]> {
    return this.getTodayMealPlanItems();
  }

  /** @deprecated Use createMealPlanItem */
  async upsertMealPlanEntry(payload: Record<string, unknown>): Promise<unknown> {
    return this.createMealPlanItem({
      ...payload,
      item_type: 'recipe',
    });
  }

  /** @deprecated Use deleteMealPlanItem */
  async deleteMealPlanEntry(id: string): Promise<void> {
    return this.deleteMealPlanItem(id);
  }

  async getFoodItemHistory(limit?: number, offset?: number): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (limit !== undefined) {
      params.set('limit', String(limit));
    }
    if (offset !== undefined) {
      params.set('offset', String(offset));
    }

    const query = params.toString();
    const path = query ? `/food-item-history?${query}` : '/food-item-history';

    const response = await this.request<{ data: unknown[] }>(path, {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async getFoodCategories(): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>('/food-categories', {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async getFoodCatalogItems(): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>('/food-catalog-items', {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async getShoppingItems(): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>('/shopping-items', {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async createShoppingItem(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/shopping-items', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async updateShoppingItem(id: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>(`/shopping-items/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async deleteShoppingItem(id: string): Promise<void> {
    await this.request<void>(`/shopping-items/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  async deleteCheckedShoppingItems(): Promise<void> {
    await this.request<void>('/shopping-items/checked', {
      method: 'DELETE',
      auth: true,
    });
  }

  async deleteAllShoppingItems(): Promise<void> {
    await this.request<void>('/shopping-items', {
      method: 'DELETE',
      auth: true,
    });
  }

  async getUserFoodProfile(): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/user-food-profile', {
      method: 'GET',
      auth: true,
    });
    return response.data;
  }

  async updateUserFoodProfile(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/user-food-profile', {
      method: 'PUT',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async updateUserDietaryPreferences(preferences: string[]): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/user-food-profile/dietary-preferences', {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ preferences }),
    });
    return response.data;
  }

  async patchUserIngredientPreference(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/user-food-profile/ingredients', {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async patchUserAllergy(payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/user-food-profile/allergies', {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async getSuggestedIngredients(limit = 10): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>(
      `/user-food-profile/suggested-ingredients?limit=${limit}`,
      {
        method: 'GET',
        auth: true,
      }
    );
    return response.data;
  }

  async resetUserFoodProfile(): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/user-food-profile/reset', {
      method: 'POST',
      auth: true,
    });
    return response.data;
  }

  async getOnboardingStatus(): Promise<{
    status: string;
    currentStep: string | null;
    draft: unknown;
    firstSmartAction: unknown;
  }> {
    const response = await this.request<{
      data: {
        status: string;
        currentStep: string | null;
        draft: unknown;
        firstSmartAction: unknown;
      };
    }>('/onboarding/status', { method: 'GET', auth: true });
    return response.data;
  }

  async patchOnboarding(patch: Record<string, unknown>): Promise<unknown> {
    const response = await this.request<{ data: unknown }>('/onboarding', {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(patch),
    });
    return response.data;
  }

  private async request<T>(
    path: string,
    options: {
      method: string;
      body?: string;
      auth?: boolean;
      token?: string;
    }
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    } else if (options.auth) {
      const session = this.getStoredSession();
      if (!session) {
        throw new Error('You must be signed in.');
      }
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }

    const response = await fetch(`${environment.localApiUrl}${path}`, {
      method: options.method,
      headers,
      body: options.body,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const data = (await response.json()) as T & ApiErrorResponse;

    if (!response.ok) {
      throw new Error(data.error ?? 'Request failed.');
    }

    return data;
  }
}
