import { Component, input, output } from '@angular/core';
import { PreparedPortion } from '../../../core/models/prepared-portion.model';
import { STORAGE_LOCATION_LABELS as LOC_LABELS } from '../../../core/models/food-item.model';
import { FoodIconBadgeComponent } from '../../../shared/components/food-icon-badge/food-icon-badge.component';
import {
  getExpirationLabel,
  getExpirationShortLabel,
  getExpirationStatus,
  isExpired,
  isExpiringSoon,
} from '../../../shared/utils/expiration.utils';
import { getPortionAvailabilityLabel } from '../../../shared/utils/prepared-portion.utils';

@Component({
  selector: 'app-prepared-portion-card',
  standalone: true,
  imports: [FoodIconBadgeComponent],
  template: `
    @if (portion(); as p) {
      <article
        class="card overflow-hidden p-4"
        [class.opacity-60]="p.status === 'finished'"
      >
        <div class="flex gap-3">
          <app-food-icon-badge [name]="p.name" category="Prepared / Leftovers" />

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold text-stone-900">{{ p.name }}</h3>
                <p class="mt-0.5 text-sm text-stone-600">{{ availabilityLabel(p) }}</p>
              </div>
              <span
                class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                [class.bg-brand-50]="statusVariant(p) === 'available'"
                [class.text-brand-700]="statusVariant(p) === 'available'"
                [class.bg-amber-50]="statusVariant(p) === 'soon'"
                [class.text-amber-700]="statusVariant(p) === 'soon'"
                [class.bg-red-50]="statusVariant(p) === 'expired'"
                [class.text-red-700]="statusVariant(p) === 'expired'"
                [class.bg-stone-100]="statusVariant(p) === 'finished'"
                [class.text-stone-500]="statusVariant(p) === 'finished'"
              >
                {{ statusLabel(p) }}
              </span>
            </div>

            <p class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
              @if (p.storage_location) {
                <span>{{ locationLabel(p.storage_location) }}</span>
                <span class="text-stone-300" aria-hidden="true">·</span>
              }
              @if (p.expires_at) {
                <span
                  [class.text-red-600]="isExpired(p.expires_at)"
                  [class.text-amber-600]="isExpiringSoon(p.expires_at, 3) && !isExpired(p.expires_at)"
                >
                  {{ getExpirationShortLabel(p.expires_at) }}
                </span>
              } @else {
                <span>No expiry date</span>
              }
              @if (p.notes) {
                <span class="text-stone-300" aria-hidden="true">·</span>
                <span class="truncate">{{ p.notes }}</span>
              }
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          @if (p.available_portions > 0) {
            <button
              type="button"
              class="btn-primary-sm"
              (click)="addToMealPlan.emit(p)"
            >
              Add to meal plan
            </button>
          }
          <button
            type="button"
            class="btn-secondary-sm"
            (click)="edit.emit(p)"
          >
            Edit
          </button>
          @if (p.available_portions > 0) {
            <button
              type="button"
              class="btn-secondary-sm"
              (click)="markEaten.emit(p)"
            >
              Mark as eaten
            </button>
            @if (p.storage_location !== 'freezer') {
              <button
                type="button"
                class="btn-secondary-sm"
                (click)="freeze.emit(p)"
              >
                Freeze
              </button>
            }
          }
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            (click)="deletePortion.emit(p)"
          >
            Delete
          </button>
        </div>
      </article>
    }
  `,
})
export class PreparedPortionCardComponent {
  readonly portion = input.required<PreparedPortion>();

  readonly addToMealPlan = output<PreparedPortion>();
  readonly edit = output<PreparedPortion>();
  readonly markEaten = output<PreparedPortion>();
  readonly freeze = output<PreparedPortion>();
  readonly deletePortion = output<PreparedPortion>();

  readonly locationLabels = LOC_LABELS;
  readonly isExpired = isExpired;
  readonly isExpiringSoon = isExpiringSoon;
  readonly getExpirationShortLabel = getExpirationShortLabel;

  availabilityLabel(portion: PreparedPortion): string {
    return getPortionAvailabilityLabel(portion);
  }

  locationLabel(location: string): string {
    return LOC_LABELS[location as keyof typeof LOC_LABELS] ?? location;
  }

  statusVariant(portion: PreparedPortion): 'available' | 'soon' | 'expired' | 'finished' {
    if (portion.status === 'finished' || portion.available_portions <= 0) {
      return 'finished';
    }
    if (portion.expires_at && isExpired(portion.expires_at)) {
      return 'expired';
    }
    if (portion.expires_at && isExpiringSoon(portion.expires_at, 3)) {
      return 'soon';
    }
    return 'available';
  }

  statusLabel(portion: PreparedPortion): string {
    const variant = this.statusVariant(portion);
    if (variant === 'finished') {
      return 'Finished';
    }
    if (variant === 'expired') {
      return 'Expired';
    }
    if (variant === 'soon') {
      return portion.expires_at ? getExpirationLabel(portion.expires_at) : 'Expiring soon';
    }
    return 'Available';
  }
}
