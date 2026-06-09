import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReusableInventoryItem } from '../../../core/models/reusable-inventory-item.model';
import { FoodIconBadgeComponent } from '../../../shared/components/food-icon-badge/food-icon-badge.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-reusable-inventory-items',
  standalone: true,
  imports: [FoodIconBadgeComponent, LoadingStateComponent],
  template: `
    <section class="card overflow-hidden bg-cream/30">
      <button
        type="button"
        class="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-stone-50/60 sm:px-5"
        [attr.aria-expanded]="isExpanded()"
        aria-controls="add-again-content"
        (click)="toggleExpanded()"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg"
          aria-hidden="true"
        >
          ↻
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-base font-semibold text-stone-900">Add Again</span>
          <span class="mt-0.5 block text-sm text-stone-600">
            Quickly add items you use often without typing them again.
          </span>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="mt-1 h-5 w-5 shrink-0 text-stone-400 transition-transform duration-200"
          [class.rotate-180]="isExpanded()"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      @if (isExpanded()) {
        <div
          id="add-again-content"
          class="border-t border-stone-200/60 px-4 pb-4 pt-3 transition-opacity duration-200 sm:px-5"
        >
          @if (isLoading()) {
            <app-loading-state message="Loading previous items..." />
          } @else if (reusableItems().length === 0) {
            <div
              class="rounded-lg border border-dashed border-stone-300 bg-stone-50/80 px-4 py-8 text-center text-sm text-stone-500"
            >
              Your recently added items will appear here.
            </div>
          } @else {
            <div
              #scrollContainer
              class="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:gap-3"
            >
              @for (item of reusableItems(); track item.id) {
                <article
                  class="flex w-[30%] min-w-[100px] shrink-0 snap-start flex-col items-center rounded-xl border bg-white p-2 text-center shadow-sm transition-all sm:min-w-[110px] sm:p-3"
                  [class.border-brand-500]="isSelected(item)"
                  [class.bg-brand-50/40]="isSelected(item)"
                  [class.border-stone-200]="!isSelected(item)"
                  [class.ring-2]="isSelected(item)"
                  [class.ring-brand-100]="isSelected(item)"
                >
                  <app-food-icon-badge
                    [name]="item.name"
                    [category]="item.category"
                    size="lg"
                  />

                  <p class="mt-2 w-full truncate text-xs font-semibold text-stone-900 sm:text-sm">
                    {{ item.name }}
                  </p>

                  <p class="mt-0.5 w-full truncate text-[11px] text-stone-500 sm:text-xs">
                    {{ item.category || '—' }}
                  </p>

                  <button
                    type="button"
                    class="btn-primary-sm mt-2 w-full px-1 py-2 text-[11px] sm:mt-3 sm:px-2 sm:py-2 sm:text-xs"
                    (click)="onAddAgain(item)"
                  >
                    Add again
                  </button>

                  @if (isSelected(item) && item.currentlyInInventory) {
                    <div
                      class="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-left"
                    >
                      <p class="text-[10px] leading-snug text-amber-900 sm:text-xs">
                        <span class="font-medium">{{ item.name }}</span>
                        already exists. Update it or add a new batch.
                      </p>
                      <div class="mt-1.5 flex flex-col gap-1">
                        <button
                          type="button"
                          class="btn-primary-sm w-full px-1 py-1.5 text-[10px] sm:text-xs"
                          (click)="updateExistingClicked.emit(item)"
                        >
                          Update existing
                        </button>
                        <button
                          type="button"
                          class="btn-secondary-sm w-full px-1 py-1.5 text-[10px] sm:text-xs"
                          (click)="addNewBatchClicked.emit(item)"
                        >
                          Add new batch
                        </button>
                      </div>
                    </div>
                  }
                </article>
              }

              @if (hasMore()) {
                <div
                  #loadMoreSentinel
                  class="flex w-8 shrink-0 items-center justify-center"
                  aria-hidden="true"
                ></div>
              }

              @if (loadingMore()) {
                <div
                  class="flex w-16 shrink-0 items-center justify-center text-xs text-stone-500"
                  aria-live="polite"
                >
                  Loading...
                </div>
              }
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class ReusableInventoryItemsComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly reusableItems = input.required<ReusableInventoryItem[]>();
  readonly selectedItem = input<ReusableInventoryItem | null>(null);
  readonly isLoading = input(false);
  readonly hasMore = input(false);
  readonly loadingMore = input(false);

  readonly itemSelected = output<ReusableInventoryItem>();
  readonly duplicateItemSelected = output<ReusableInventoryItem>();
  readonly updateExistingClicked = output<ReusableInventoryItem>();
  readonly addNewBatchClicked = output<ReusableInventoryItem>();
  readonly loadMoreRequested = output<void>();

  readonly isExpanded = signal(false);

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly loadMoreSentinel = viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');

  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => {
      const isMobile = window.matchMedia('(max-width: 639px)').matches;
      if (!isMobile && this.reusableItems().length > 0) {
        this.isExpanded.set(true);
      }
    });

    effect(() => {
      this.isExpanded();
      this.hasMore();
      this.loadingMore();
      this.reusableItems().length;

      queueMicrotask(() => this.setupLoadMoreObserver());
    });

    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      this.observer = null;
    });
  }

  toggleExpanded(): void {
    this.isExpanded.update((value) => !value);

    if (this.isExpanded()) {
      queueMicrotask(() => this.setupLoadMoreObserver());
    } else {
      this.observer?.disconnect();
      this.observer = null;
    }
  }

  isSelected(item: ReusableInventoryItem): boolean {
    const selected = this.selectedItem();
    return selected?.id === item.id;
  }

  onAddAgain(item: ReusableInventoryItem): void {
    if (item.currentlyInInventory) {
      this.duplicateItemSelected.emit(item);
      return;
    }
    this.itemSelected.emit(item);
  }

  private setupLoadMoreObserver(): void {
    this.observer?.disconnect();
    this.observer = null;

    if (!this.isExpanded() || !this.hasMore()) {
      return;
    }

    const container = this.scrollContainer()?.nativeElement;
    const sentinel = this.loadMoreSentinel()?.nativeElement;

    if (!container || !sentinel) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.loadMoreRequested.emit();
        }
      },
      {
        root: container,
        rootMargin: '0px 80px 0px 0px',
        threshold: 0,
      }
    );

    this.observer.observe(sentinel);
  }
}
