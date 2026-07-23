import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { LANDING_BENEFITS, LANDING_FAQS } from './landing-content.config';
import { LandingAnalyticsService } from './landing-analytics.service';
import { LandingProductPreviewComponent } from './landing-product-preview.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, LandingProductPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-x-clip bg-cream text-pantry-charcoal' },
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent implements OnInit, OnDestroy {
  private readonly analytics = inject(LandingAnalyticsService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly observers: IntersectionObserver[] = [];

  readonly menuOpen = signal(false);
  readonly openFaq = signal<number | null>(null);
  readonly benefits = LANDING_BENEFITS;
  readonly faqs = LANDING_FAQS;
  readonly year = new Date().getFullYear();

  ngOnInit(): void {
    this.setMetadata();
    this.analytics.track('landing_view');
    if (isPlatformBrowser(this.platformId)) queueMicrotask(() => this.observeSections());
  }

  ngOnDestroy(): void { this.observers.forEach((observer) => observer.disconnect()); }

  goToSignup(location: 'header' | 'hero' | 'benefits' | 'final'): void {
    const event = location === 'header' ? 'header_cta_clicked' : location === 'hero' ? 'hero_primary_cta_clicked' : 'final_cta_clicked';
    this.analytics.track(event, { location });
    this.analytics.track('signup_started', { location });
    const queryParams = this.campaignParams();
    void this.router.navigate(['/auth/login'], { queryParams: { ...queryParams, mode: 'signup' } });
  }

  login(): void {
    this.analytics.track('login_clicked', { location: 'header' });
    void this.router.navigate(['/auth/login'], { queryParams: this.campaignParams() });
  }

  secondaryCta(): void {
    this.analytics.track('hero_secondary_cta_clicked', { location: 'hero' });
    this.document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  }

  toggleFaq(index: number): void {
    this.openFaq.update((current) => current === index ? null : index);
    if (this.openFaq() === index) this.analytics.track('faq_opened', { question: this.faqs[index].question });
  }

  closeMenu(): void { this.menuOpen.set(false); }

  private campaignParams(): Record<string, string> {
    if (!isPlatformBrowser(this.platformId)) return {};
    const params = new URLSearchParams(this.document.location.search);
    return Object.fromEntries([...params.entries()].filter(([key]) => key.startsWith('utm_')));
  }

  private observeSections(): void {
    const targets = [
      { id: 'how-it-works', event: 'how_it_works_viewed' as const },
      { id: 'features', event: 'feature_section_viewed' as const },
    ];
    for (const target of targets) {
      const element = this.document.getElementById(target.id);
      if (!element) continue;
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { this.analytics.track(target.event, { section: target.id }); observer.disconnect(); }
      }, { threshold: 0.3 });
      observer.observe(element);
      this.observers.push(observer);
    }
  }

  private setMetadata(): void {
    const title = 'Soozi — Weekly meal planning around what you already have';
    const description = 'Plan weekly meals around pantry ingredients, use food before it expires, organize prepared portions, and cook fewer times with Soozi.';
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = '/';
    let structuredData = this.document.getElementById('soozi-structured-data');
    if (!structuredData) {
      structuredData = this.document.createElement('script');
      structuredData.id = 'soozi-structured-data';
      structuredData.setAttribute('type', 'application/ld+json');
      this.document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Soozi',
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
      description,
    });
  }
}
