import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FoodIconService } from '../../../core/services/food-icon.service';
import { ReusableInventoryItem } from '../../../core/models/reusable-inventory-item.model';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { tileBackgroundColor } from '../../../shared/utils/tile-background-color.utils';

const LOOP_COPIES = 3;
const AUTO_SCROLL_INTERVAL_MS = 3000;
const AUTO_SCROLL_RESUME_DELAY_MS = 2000;

@Component({
  selector: 'app-reusable-inventory-items',
  standalone: true,
  imports: [LoadingStateComponent],
  template: `
    <section aria-label="Add again">
      <h2 class="section-title mb-3">Add Again</h2>

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
          class="add-again-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1"
          role="list"
          (scroll)="onScroll()"
          (pointerenter)="onUserInteractionStart()"
          (pointerdown)="onUserInteractionStart()"
          (pointerleave)="onUserInteractionEnd()"
          (pointerup)="onUserInteractionEnd()"
          (pointercancel)="onUserInteractionEnd()"
        >
          @for (item of loopedItems(); track $index) {
            <button
              type="button"
              class="group block w-[76px] shrink-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              [class.ring-2]="isSelected(item)"
              [class.ring-brand-500]="isSelected(item)"
              [class.ring-offset-2]="isSelected(item)"
              role="listitem"
              data-reusable-tile
              [attr.aria-label]="'Add ' + item.name + ' again'"
              (click)="onAddAgain(item)"
            >
              <div
                class="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl transition-transform group-hover:scale-[1.03] group-active:scale-[0.98]"
                [style.background-color]="colorFor(item)"
                aria-hidden="true"
              >
                <span class="text-3xl leading-none">{{ iconFor(item) }}</span>
              </div>
              <p class="mt-1.5 truncate text-center text-xs font-medium text-stone-700">
                {{ item.name }}
              </p>
            </button>
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

        @if (selectedItem(); as duplicate) {
          @if (duplicate.currentlyInInventory) {
            <div
              class="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p class="text-sm text-amber-900">
                <span class="font-medium">{{ duplicate.name }}</span>
                already exists. Update it or add a new batch.
              </p>
              <div class="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  class="btn-primary-sm"
                  (click)="updateExistingClicked.emit(duplicate)"
                >
                  Update existing
                </button>
                <button
                  type="button"
                  class="btn-secondary-sm"
                  (click)="addNewBatchClicked.emit(duplicate)"
                >
                  Add new batch
                </button>
              </div>
            </div>
          }
        }
      }
    </section>
  `,
  styles: `
    .add-again-scroll {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .add-again-scroll::-webkit-scrollbar {
      display: none;
    }
  `,
})
export class ReusableInventoryItemsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly foodIconService = inject(FoodIconService);

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

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly loadMoreSentinel = viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.stopAutoScroll();
      return;
    }

    if (!this.isUserInteracting && !this.isPaused) {
      this.startAutoScroll();
    }
  };

  private setWidth = 0;
  private stepPx = 0;
  private isAdjustingScroll = false;
  private isPaused = false;
  private isUserInteracting = false;
  private autoScrollTimer: ReturnType<typeof setInterval> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private loadMoreObserver: IntersectionObserver | null = null;

  readonly loopedItems = computed(() => {
    const items = this.reusableItems();
    if (items.length < LOOP_COPIES) {
      return items;
    }
    return Array.from({ length: LOOP_COPIES }, () => items).flat();
  });

  readonly shouldLoop = computed(() => this.reusableItems().length >= LOOP_COPIES);

  constructor() {
    afterNextRender(() => {
      this.measureAndCenter();
    });

    effect(() => {
      this.reusableItems().length;
      this.isLoading();
      this.loadingMore();
      this.hasMore();

      queueMicrotask(() => {
        this.measureAndCenter();
        this.setupLoadMoreObserver();
      });
    });

    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.destroyRef.onDestroy(() => {
      this.isAdjustingScroll = false;
      this.stopAutoScroll();
      this.clearResumeTimer();
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.loadMoreObserver?.disconnect();
      this.loadMoreObserver = null;
    });
  }

  colorFor(item: ReusableInventoryItem): string {
    return tileBackgroundColor(item.category, item.name);
  }

  iconFor(item: ReusableInventoryItem): string {
    this.foodIconService.iconDataVersion();
    return this.foodIconService.resolveIcon(item.name, item.category);
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

  onUserInteractionStart(): void {
    this.isUserInteracting = true;
    this.pauseAutoScroll();
  }

  onUserInteractionEnd(): void {
    this.isUserInteracting = false;
    this.scheduleResume();
  }

  onScroll(): void {
    if (!this.isAdjustingScroll && this.isUserInteracting) {
      this.pauseAutoScroll();
    }

    if (this.isAdjustingScroll || this.setWidth <= 0 || !this.shouldLoop()) {
      return;
    }

    const container = this.scrollContainer()?.nativeElement;
    if (!container) {
      return;
    }

    const { scrollLeft } = container;
    const buffer = 4;

    if (scrollLeft <= buffer) {
      this.jumpScroll(container, scrollLeft + this.setWidth);
      return;
    }

    if (scrollLeft >= this.setWidth * 2 - buffer) {
      this.jumpScroll(container, scrollLeft - this.setWidth);
    }
  }

  private measureAndCenter(): void {
    const container = this.scrollContainer()?.nativeElement;
    if (!container) {
      return;
    }

    this.stopAutoScroll();

    if (this.shouldLoop()) {
      this.setWidth = container.scrollWidth / LOOP_COPIES;
    } else {
      this.setWidth = 0;
    }

    this.stepPx = this.measureStepPx(container);

    if (this.setWidth > 0) {
      this.jumpScroll(container, this.setWidth);
    }

    if (
      this.stepPx > 0 &&
      container.scrollWidth > container.clientWidth &&
      !this.prefersReducedMotion() &&
      !this.isLoading() &&
      !this.loadingMore()
    ) {
      this.isPaused = false;
      this.startAutoScroll();
    }
  }

  private measureStepPx(container: HTMLElement): number {
    const firstTile = container.querySelector<HTMLElement>('[data-reusable-tile]');
    if (!firstTile) {
      return 0;
    }

    const tileWidth = firstTile.getBoundingClientRect().width;
    const gapValue = getComputedStyle(container).columnGap || getComputedStyle(container).gap;
    const gap = Number.parseFloat(gapValue) || 0;

    return tileWidth + gap;
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private startAutoScroll(): void {
    if (
      this.autoScrollTimer ||
      this.isPaused ||
      this.isUserInteracting ||
      document.hidden ||
      this.isLoading() ||
      this.loadingMore()
    ) {
      return;
    }

    this.autoScrollTimer = setInterval(() => {
      this.advanceOneStep();
    }, AUTO_SCROLL_INTERVAL_MS);
  }

  private stopAutoScroll(): void {
    if (!this.autoScrollTimer) {
      return;
    }

    clearInterval(this.autoScrollTimer);
    this.autoScrollTimer = null;
  }

  private pauseAutoScroll(): void {
    this.isPaused = true;
    this.stopAutoScroll();
    this.clearResumeTimer();
  }

  private scheduleResume(): void {
    this.clearResumeTimer();

    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      if (this.isUserInteracting || document.hidden || this.isLoading() || this.loadingMore()) {
        return;
      }

      this.isPaused = false;
      this.startAutoScroll();
    }, AUTO_SCROLL_RESUME_DELAY_MS);
  }

  private clearResumeTimer(): void {
    if (!this.resumeTimer) {
      return;
    }

    clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
  }

  private advanceOneStep(): void {
    if (
      this.isPaused ||
      this.isUserInteracting ||
      this.stepPx <= 0 ||
      document.hidden ||
      this.isLoading() ||
      this.loadingMore()
    ) {
      return;
    }

    const container = this.scrollContainer()?.nativeElement;
    if (!container || container.scrollWidth <= container.clientWidth) {
      return;
    }

    container.scrollBy({ left: this.stepPx, behavior: 'smooth' });
  }

  private jumpScroll(container: HTMLElement, targetLeft: number): void {
    this.isAdjustingScroll = true;
    container.scrollLeft = targetLeft;
    requestAnimationFrame(() => {
      this.isAdjustingScroll = false;
    });
  }

  private setupLoadMoreObserver(): void {
    this.loadMoreObserver?.disconnect();
    this.loadMoreObserver = null;

    if (!this.hasMore()) {
      return;
    }

    const container = this.scrollContainer()?.nativeElement;
    const sentinel = this.loadMoreSentinel()?.nativeElement;

    if (!container || !sentinel) {
      return;
    }

    this.loadMoreObserver = new IntersectionObserver(
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

    this.loadMoreObserver.observe(sentinel);
  }
}
