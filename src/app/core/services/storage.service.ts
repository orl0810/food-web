import { Injectable, inject } from '@angular/core';
import { PlatformService } from './platform.service';

/**
 * Typed web storage wrapper. Preserves localStorage behavior on web.
 * A Capacitor Preferences-backed implementation can replace the internals later.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly platform = inject(PlatformService);

  getItem(key: string): string | null {
    if (!this.platform.isBrowser()) {
      return null;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.platform.isBrowser()) {
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable (private mode / quota) — callers treat as non-fatal.
    }
  }

  removeItem(key: string): void {
    if (!this.platform.isBrowser()) {
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  getJson<T>(key: string): T | null {
    const raw = this.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setJson(key: string, value: unknown): void {
    this.setItem(key, JSON.stringify(value));
  }
}
