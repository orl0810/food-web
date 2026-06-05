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

  async getFoodItemHistory(): Promise<unknown[]> {
    const response = await this.request<{ data: unknown[] }>('/food-item-history', {
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
