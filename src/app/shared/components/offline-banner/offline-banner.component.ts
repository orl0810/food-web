import { Component, inject } from '@angular/core';
import { NetworkStatusService } from '../../../core/services/network-status.service';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  template: `
    @if (!network.online()) {
      <div
        class="offline-banner"
        role="status"
        aria-live="polite"
      >
        You appear to be offline. Some actions may fail until you reconnect.
      </div>
    }
  `,
  styles: `
    .offline-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 90;
      padding: 0.5rem 1rem;
      padding-top: calc(0.5rem + var(--safe-area-top));
      background: #fef3c7;
      color: #92400e;
      font-size: 0.875rem;
      text-align: center;
      border-bottom: 1px solid #fcd34d;
    }
  `,
})
export class OfflineBannerComponent {
  readonly network = inject(NetworkStatusService);
}
