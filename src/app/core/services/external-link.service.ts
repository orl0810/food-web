import { Injectable, inject } from '@angular/core';
import { PlatformService } from './platform.service';

/**
 * Opens external URLs and downloads files.
 * Web implementation uses window/document; Capacitor Browser / Share can be added later.
 */
@Injectable({ providedIn: 'root' })
export class ExternalLinkService {
  private readonly platform = inject(PlatformService);

  /**
   * Navigate the current context to an absolute http(s) URL
   * (e.g. Stripe Checkout). On native, swap to Browser plugin later.
   */
  async openExternalUrl(url: string): Promise<void> {
    if (!this.platform.isBrowser()) {
      return;
    }
    window.location.assign(url);
  }

  /**
   * Trigger a file download in the browser.
   * On native, swap to Share / Filesystem later.
   */
  downloadBlob(blob: Blob, filename: string): void {
    if (!this.platform.isBrowser()) {
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
