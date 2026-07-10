import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { LandingAnalyticsEvent } from './landing-content.config';

export interface LandingEventDetail {
  readonly location?: string;
  readonly section?: string;
  readonly question?: string;
  readonly route: string;
  readonly referrer?: string;
  readonly campaign?: Readonly<Record<string, string>>;
}

@Injectable({ providedIn: 'root' })
export class LandingAnalyticsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  track(event: LandingAnalyticsEvent, metadata: Omit<LandingEventDetail, 'route' | 'referrer' | 'campaign'> = {}): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = new URL(this.document.location.href);
    const campaign = Object.fromEntries(
      [...url.searchParams.entries()].filter(([key]) => key.startsWith('utm_'))
    );
    const detail: LandingEventDetail = {
      ...metadata,
      route: url.pathname,
      referrer: this.document.referrer || undefined,
      campaign: Object.keys(campaign).length ? campaign : undefined,
    };
    window.dispatchEvent(new CustomEvent(`pantryflow:${event}`, { detail }));
  }
}
