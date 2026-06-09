import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';

export type StatCardVariant = 'default' | 'success' | 'warning' | 'danger';
export type StatCardIcon = 'basket' | 'clock' | 'warning' | 'fridge' | 'freezer' | 'pantry';
export type StatCardLayout = 'horizontal' | 'stacked';

const ICON_STYLES: Record<StatCardIcon, { bg: string; text: string }> = {
  basket: { bg: 'bg-green-100', text: 'text-green-600' },
  clock: { bg: 'bg-amber-100', text: 'text-amber-600' },
  warning: { bg: 'bg-red-100', text: 'text-red-600' },
  fridge: { bg: 'bg-blue-100', text: 'text-blue-700' },
  freezer: { bg: 'bg-sky-100', text: 'text-sky-600' },
  pantry: { bg: 'bg-amber-50', text: 'text-amber-800' },
};

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgTemplateOutlet],
  host: { class: 'block h-full' },
  template: `
    @if (layout() === 'stacked') {
      <div class="flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-stone-200 bg-card p-2 text-center shadow-sm sm:min-h-24 sm:gap-1.5 sm:p-3">
        @if (icon()) {
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9"
            [class]="iconStyles().bg"
          >
            <ng-container *ngTemplateOutlet="iconContent" />
          </div>
        }

        <p class="text-[10px] font-medium leading-tight text-muted sm:text-xs">{{ label() }}</p>
        <p class="leading-none">
          <span
            class="text-base font-semibold sm:text-lg"
            [class.text-stone-900]="variant() !== 'danger'"
            [class.text-red-600]="variant() === 'danger'"
          >
            {{ value() }}
          </span>
          @if (unit()) {
            <span class="text-[10px] font-normal text-stone-600 sm:text-xs">{{ unit() }}</span>
          }
        </p>
        @if (subtitle()) {
          <p class="text-[10px] text-stone-600 sm:text-xs">{{ subtitle() }}</p>
        }
      </div>
    } @else {
      <div class="flex h-full min-h-24 items-center gap-3 rounded-xl border border-stone-200 bg-card p-3 shadow-sm sm:min-h-28 sm:gap-4 sm:p-4">
        @if (icon()) {
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10"
            [class]="iconStyles().bg"
          >
            <ng-container *ngTemplateOutlet="iconContent" />
          </div>
        }

        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium leading-snug text-muted sm:text-sm">{{ label() }}</p>
          <p class="mt-0.5 leading-tight sm:mt-1">
            <span
              class="text-lg font-semibold sm:text-2xl"
              [class.text-stone-900]="variant() !== 'danger'"
              [class.text-red-600]="variant() === 'danger'"
            >
              {{ value() }}
            </span>
            @if (unit()) {
              <span class="text-xs font-normal text-stone-600">{{ unit() }}</span>
            }
          </p>
          @if (subtitle()) {
            <p class="mt-0.5 text-xs text-stone-600">{{ subtitle() }}</p>
          }
        </div>
      </div>
    }

    <ng-template #iconContent>
      <span [class]="iconStyles().text" class="h-4 w-4 sm:h-5 sm:w-5">
        @switch (icon()) {
          @case ('basket') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 sm:h-5 sm:w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          }
          @case ('clock') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 sm:h-5 sm:w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
          @case ('warning') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 sm:h-5 sm:w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          }
          @case ('fridge') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 sm:h-5 sm:w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3.75h10.5A1.5 1.5 0 0 1 18.75 5.25v13.5a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5ZM9 6.75v10.5M9 12h6" />
            </svg>
          }
          @case ('freezer') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 sm:h-5 sm:w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m-4.5-4.5L12 12m4.5-4.5L12 12M7.5 12H3m18 0h-4.5M12 7.5V3m0 18v-4.5" />
            </svg>
          }
          @case ('pantry') {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 sm:h-5 sm:w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h7.5M8.25 9.75h7.5m-4.5 9.75v-3.75a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v3.75M6 21.75h12A2.25 2.25 0 0 0 20.25 19.5V8.25A2.25 2.25 0 0 0 18 6H6A2.25 2.25 0 0 0 3.75 8.25v11.25A2.25 2.25 0 0 0 6 21.75Z" />
            </svg>
          }
        }
      </span>
    </ng-template>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly subtitle = input<string>();
  readonly unit = input<string>();
  readonly variant = input<StatCardVariant>('default');
  readonly icon = input<StatCardIcon>();
  readonly layout = input<StatCardLayout>('horizontal');

  readonly iconStyles = computed(() => {
    const icon = this.icon();
    return icon ? ICON_STYLES[icon] : { bg: 'bg-stone-100', text: 'text-stone-600' };
  });
}
