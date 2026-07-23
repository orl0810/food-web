import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { PlatformService } from './platform.service';

/**
 * Minimal online/offline status for UI messaging.
 * Capacitor Network plugin can replace listeners later.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService implements OnDestroy {
  private readonly platform = inject(PlatformService);
  private readonly onlineSignal = signal(true);
  private readonly onOnline = (): void => this.onlineSignal.set(true);
  private readonly onOffline = (): void => this.onlineSignal.set(false);

  readonly online = this.onlineSignal.asReadonly();

  constructor() {
    if (!this.platform.isBrowser()) {
      return;
    }
    this.onlineSignal.set(navigator.onLine);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
  }

  ngOnDestroy(): void {
    if (!this.platform.isBrowser()) {
      return;
    }
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
  }

  isOnline(): boolean {
    return this.onlineSignal();
  }
}
