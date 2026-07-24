import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Thin platform abstraction for web today.
 * Native Capacitor detection can be added later without changing call sites.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly platformId = inject(PLATFORM_ID);

  /** True when running in a browser (or Capacitor WebView). */
  isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * True when packaged as a native Capacitor app.
   * Always false until Capacitor is installed and wired.
   */
  isNative(): boolean {
    return false;
  }

  isOnline(): boolean {
    if (!this.isBrowser()) {
      return true;
    }
    return navigator.onLine;
  }
}
