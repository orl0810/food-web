import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_PLACEHOLDERS, LegalPageContent } from './legal.model';

@Component({
  selector: 'app-legal-page-layout',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-screen bg-cream text-pantry-charcoal' },
  styles: [
    `
      .legal-container {
        width: min(calc(100% - 2rem), 48rem);
        margin-inline: auto;
      }
      .legal-section {
        scroll-margin-top: 1.5rem;
      }
    `,
  ],
  template: `
    <header class="border-b border-[#eadcc8] bg-cream">
      <div class="legal-container flex items-center justify-between py-5">
        <a
          routerLink="/"
          class="text-lg font-bold text-pantry-charcoal hover:text-brand-800"
        >
          {{ appName }}
        </a>
        <a
          routerLink="/"
          class="text-sm font-medium text-brand-700 underline decoration-[#b7a894] underline-offset-4 hover:text-brand-800"
        >
          Back to home
        </a>
      </div>
    </header>

    <main class="py-10 sm:py-14">
      <article class="legal-container">
        <header class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#ddcfbd] sm:p-8">
          <h1 class="text-3xl font-bold tracking-tight text-pantry-charcoal sm:text-4xl">
            {{ content().title }}
          </h1>
          <p class="mt-3 text-sm text-stone-500">
            Last updated: {{ content().lastUpdated }}
          </p>
          <p class="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            This document is a draft for review and does not constitute legal advice. Please
            consult a qualified lawyer before relying on it for compliance purposes.
          </p>
          <p class="mt-5 text-base leading-7 text-stone-600">{{ content().intro }}</p>
        </header>

        @if (content().sections.length > 1) {
          <nav
            class="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#ddcfbd] sm:p-8"
            aria-label="Table of contents"
          >
            <h2 class="text-sm font-bold uppercase tracking-wide text-stone-500">On this page</h2>
            <ol class="mt-4 space-y-2">
              @for (section of content().sections; track section.id) {
                <li>
                  <a
                    [href]="'#' + section.id"
                    class="text-sm font-medium text-brand-700 underline decoration-[#b7a894] underline-offset-4 hover:text-brand-800"
                  >
                    {{ section.title }}
                  </a>
                </li>
              }
            </ol>
          </nav>
        }

        <div class="mt-8 space-y-8">
          @for (section of content().sections; track section.id) {
            <section
              [id]="section.id"
              class="legal-section rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#ddcfbd] sm:p-8"
            >
              <h2 class="text-xl font-bold text-pantry-charcoal sm:text-2xl">
                {{ section.title }}
              </h2>
              @for (paragraph of section.paragraphs; track paragraph) {
                <p class="mt-4 text-base leading-7 text-stone-600">{{ paragraph }}</p>
              }
              @if (section.list?.length) {
                <ul class="mt-4 list-disc space-y-2 pl-5 text-base leading-7 text-stone-600">
                  @for (item of section.list; track item) {
                    <li>{{ item }}</li>
                  }
                </ul>
              }
            </section>
          }
        </div>
      </article>
    </main>

    <footer class="border-t border-[#eadcc8] bg-cream py-10">
      <div class="legal-container">
        <nav class="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Legal pages">
          <a
            routerLink="/privacy"
            class="font-medium text-brand-700 underline decoration-[#b7a894] underline-offset-4 hover:text-brand-800"
          >
            Privacy Policy
          </a>
          <span class="text-stone-400" aria-hidden="true">·</span>
          <a
            routerLink="/terms"
            class="font-medium text-brand-700 underline decoration-[#b7a894] underline-offset-4 hover:text-brand-800"
          >
            Terms of Service
          </a>
          <span class="text-stone-400" aria-hidden="true">·</span>
          <a
            routerLink="/cookies"
            class="font-medium text-brand-700 underline decoration-[#b7a894] underline-offset-4 hover:text-brand-800"
          >
            Cookie Policy
          </a>
        </nav>
        <p class="mt-4 text-sm text-stone-600">
          Questions?
          <a
            [href]="'mailto:' + supportEmail"
            class="font-medium text-brand-700 underline decoration-[#b7a894] underline-offset-4 hover:text-brand-800"
          >
            {{ supportEmail }}
          </a>
        </p>
        <p class="mt-6 text-xs text-stone-500">
          © {{ year }} {{ appName }}. All rights reserved.
        </p>
      </div>
    </footer>
  `,
})
export class LegalPageLayoutComponent {
  readonly content = input.required<LegalPageContent>();
  readonly appName = LEGAL_PLACEHOLDERS.appName;
  readonly supportEmail = LEGAL_PLACEHOLDERS.supportEmail;
  readonly year = new Date().getFullYear();
}
