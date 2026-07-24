import { Injectable, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Driver, PopoverDOM, driver } from 'driver.js';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MealPlanService } from '../services/meal-plan.service';
import { OnboardingService } from '../services/onboarding.service';
import { PlatformService } from '../services/platform.service';
import { FIRST_TOUR_COPY } from './first-tour.definition';
import { FirstTourEventsService } from './first-tour-events.service';
import { FirstTourStep } from './first-tour.models';
import { FIRST_TOUR_SELECTORS } from './first-tour.selectors';
import { FirstTourStorageService } from './first-tour-storage.service';

const STEP_ROUTES: Record<FirstTourStep, string> = {
  1: '/dashboard',
  2: '/meal-plan',
  3: '/shopping-list',
  4: '/inventory',
  5: '/meal-plan',
};

@Injectable({ providedIn: 'root' })
export class FirstTourCoordinatorService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(OnboardingService);
  private readonly storage = inject(FirstTourStorageService);
  private readonly events = inject(FirstTourEventsService);
  private readonly mealPlan = inject(MealPlanService);
  private readonly platform = inject(PlatformService);

  private driverInstance: Driver | null = null;
  private observer: MutationObserver | null = null;
  private timeoutId: number | null = null;
  private subscriptions = new Subscription();
  private autoOfferCheckedForUser: string | null = null;
  private restoreFocusTo: HTMLElement | null = null;
  private targetedMealIds = new Set<string>();
  private readonly keydownHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.active()) {
      event.preventDefault();
      this.dismiss();
    }
  };

  readonly active = signal(false);
  readonly currentStep = signal<FirstTourStep>(1);

  constructor() {
    this.subscriptions.add(
      this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => this.onNavigation(event.urlAfterRedirects))
    );
    this.subscriptions.add(
      this.events.events$.subscribe((event) => {
        if (!this.active()) return;
        if (event.type === 'meal-plan-generated' && this.currentStep() === 2) {
          const usable = event.result.generatedCount > 0 &&
            this.mealPlan.entries().some((item) => item.status === 'planned' && !!item.recipe_id);
          if (usable) void this.advanceTo(3);
        }
        if (event.type === 'shopping-item-moved' && this.currentStep() === 3) {
          void this.advanceTo(4);
        }
        if (
          event.type === 'meal-status-persisted' &&
          event.status === 'prepared' &&
          this.currentStep() === 5 &&
          event.itemIds.some((id) => this.targetedMealIds.has(id))
        ) {
          this.complete();
        }
      })
    );

    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this.destroy();
        this.autoOfferCheckedForUser = null;
        return;
      }
      if (this.router.url.startsWith('/dashboard')) {
        void this.offerIfEligible(user.id);
      }
    });
  }

  async replay(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this.storage.reset(userId);
    await this.start(1);
  }

  async start(step?: FirstTourStep): Promise<void> {
    if (!this.platform.isBrowser()) return;
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const saved = this.storage.get(userId);
    const nextStep = step ?? (saved?.status === 'in_progress' ? saved.currentStep : 1);
    this.restoreFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.active.set(true);
    document.addEventListener('keydown', this.keydownHandler);
    this.currentStep.set(nextStep);
    this.storage.save(userId, 'in_progress', nextStep);
    await this.showStep(nextStep);
  }

  dismiss(): void {
    const userId = this.auth.user()?.id;
    if (userId) this.storage.save(userId, 'skipped', this.currentStep());
    this.destroy();
  }

  destroy(): void {
    if (this.platform.isBrowser()) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
    this.clearWaiting();
    this.driverInstance?.destroy();
    this.driverInstance = null;
    this.targetedMealIds.clear();
    this.active.set(false);
    this.restoreFocusTo?.focus();
    this.restoreFocusTo = null;
  }

  private async offerIfEligible(userId: string): Promise<void> {
    if (this.autoOfferCheckedForUser === userId || this.active()) return;
    this.autoOfferCheckedForUser = userId;
    const existing = this.storage.get(userId);
    if (existing?.status === 'completed' || existing?.status === 'skipped') return;
    const starter = await this.onboarding.getStatus();
    if (starter.status !== 'completed' && starter.status !== 'skipped') return;
    await this.start(existing?.currentStep);
  }

  private async advanceTo(step: FirstTourStep): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this.currentStep.set(step);
    this.storage.save(userId, 'in_progress', step);
    await this.showStep(step);
  }

  private complete(): void {
    const userId = this.auth.user()?.id;
    if (userId) this.storage.save(userId, 'completed', 5);
    this.destroy();
  }

  private async showStep(step: FirstTourStep): Promise<void> {
    this.clearWaiting();
    this.driverInstance?.destroy();
    this.driverInstance = null;

    const route = STEP_ROUTES[step];
    if (!this.router.url.startsWith(route)) {
      if (step === 5) {
        const target = this.findTargetMeal();
        if (!target) {
          await this.router.navigate(['/meal-plan']);
          this.showFallback(step, 'No current or future planned recipe is available yet.');
          return;
        }
        this.targetedMealIds = new Set(
          this.mealPlan.getItemsForSlot(target.date, target.meal_type).map((item) => item.id)
        );
        await this.router.navigate(['/meal-plan'], {
          queryParams: { date: target.date, tourMealType: target.meal_type },
        });
      } else {
        await this.router.navigateByUrl(route);
      }
      return;
    }

    if (step === 1) {
      this.highlight(step);
      return;
    }

    const selector = this.selectorFor(step);
    const element = await this.waitForVisible(selector);
    if (!this.active() || this.currentStep() !== step) return;
    element ? this.highlight(step, element) : this.showFallback(step);
  }

  private selectorFor(step: FirstTourStep): string {
    switch (step) {
      case 2: return FIRST_TOUR_SELECTORS.generator;
      case 3: return `${FIRST_TOUR_SELECTORS.shoppingCheckbox}, ${FIRST_TOUR_SELECTORS.shoppingFallback}`;
      case 4: return `${FIRST_TOUR_SELECTORS.inventoryRow}, ${FIRST_TOUR_SELECTORS.inventoryFallback}`;
      case 5: return FIRST_TOUR_SELECTORS.mealStatusAction;
      default: return '';
    }
  }

  private highlight(step: FirstTourStep, element?: Element): void {
    const copy = FIRST_TOUR_COPY[step];
    const needsContinue = this.needsContinueButton(step, element);
    const interactive = !needsContinue;
    const isTipOnly = step === 2;
    this.driverInstance = driver({
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      allowClose: true,
      allowKeyboardControl: false,
      overlayClickBehavior: () => undefined,
      disableActiveInteraction: step === 1 || step === 4,
      popoverClass: this.popoverClass(interactive),
      stagePadding: 8,
      stageRadius: 16,
      onCloseClick: () => this.dismiss(),
      onNextClick: () => {
        if (step === 1) void this.advanceTo(2);
        if (step === 3) void this.advanceTo(4);
        if (step === 4) void this.advanceTo(5);
      },
      onPopoverRender: (popover) => this.renderControls(popover, step, element),
    });
    this.driverInstance.highlight({
      ...(element ? { element } : {}),
      popover: {
        title: copy.title,
        description: copy.description,
        // Prefer top so the tip does not cover the highlighted CTA / dialog footer.
        side: element ? (interactive ? 'top' : 'bottom') : undefined,
        align: 'center',
        showButtons: needsContinue ? ['next', 'close'] : ['close'],
        showProgress: !isTipOnly,
        nextBtnText: copy.action,
      },
    });

    if (step === 2) this.watchForGeneratorDialog();
  }

  private renderControls(popover: PopoverDOM, step: FirstTourStep, element?: Element): void {
    const needsContinue = this.needsContinueButton(
      step,
      element ?? this.visibleTarget(step) ?? undefined
    );
    popover.wrapper.className = `driver-popover ${this.popoverClass(!needsContinue)}`;
    popover.previousButton.hidden = true;
    popover.previousButton.style.display = 'none';
    popover.footer.querySelectorAll('.soozi-tour-instruction').forEach((node) => node.remove());

    if (step === 2) {
      popover.progress.style.display = 'none';
      popover.footer.style.display = 'none';
      queueMicrotask(() => popover.closeButton.focus());
      return;
    }

    popover.progress.style.display = '';
    popover.footer.style.display = '';
    popover.progress.textContent = `Step ${step} of 5`;
    popover.progress.setAttribute('aria-live', 'polite');

    if (needsContinue) {
      popover.nextButton.textContent = FIRST_TOUR_COPY[step].action;
      popover.nextButton.classList.add('soozi-tour-action');
      popover.nextButton.hidden = false;
      popover.nextButton.removeAttribute('disabled');
      popover.nextButton.style.display = 'inline-flex';
      queueMicrotask(() => popover.nextButton.focus());
      return;
    }

    const instruction = document.createElement('span');
    instruction.className = 'soozi-tour-instruction';
    instruction.textContent = step === 3
      ? 'Check the highlighted item to continue.'
      : 'Use “Mark as cooked” to finish.';
    popover.footer.insertBefore(instruction, popover.footerButtons);
    queueMicrotask(() => (elementIsFocusable(this.driverInstance?.getActiveElement())
      ? this.driverInstance?.getActiveElement() as HTMLElement
      : popover.closeButton).focus());
  }

  private watchForGeneratorDialog(): void {
    const retarget = () => {
      const dialog = this.visibleElement(FIRST_TOUR_SELECTORS.generatorDialog);
      if (dialog && this.currentStep() === 2) {
        this.driverInstance?.highlight({
          element: dialog,
          disableActiveInteraction: false,
          popover: {
            title: FIRST_TOUR_COPY[2].title,
            description: FIRST_TOUR_COPY[2].description,
            side: 'top',
            align: 'center',
            showButtons: ['close'],
            showProgress: false,
            popoverClass: this.popoverClass(true),
            onPopoverRender: (popover) => {
              popover.wrapper.className = `driver-popover ${this.popoverClass(true)}`;
              popover.previousButton.hidden = true;
              popover.previousButton.style.display = 'none';
              popover.progress.style.display = 'none';
              popover.footer.style.display = 'none';
              popover.footer.querySelectorAll('.soozi-tour-instruction').forEach((node) => node.remove());
            },
          },
        });
        this.clearWaiting();
      }
    };
    this.observer = new MutationObserver(retarget);
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private showFallback(step: FirstTourStep, message = 'This tour target did not become available.'): void {
    this.driverInstance = driver({
      allowClose: true,
      popoverClass: this.popoverClass(false),
      onCloseClick: () => this.dismiss(),
      onNextClick: () => void this.showStep(step),
      onPopoverRender: (popover) => {
        popover.wrapper.className = `driver-popover ${this.popoverClass(false)}`;
        popover.previousButton.hidden = true;
        popover.previousButton.style.display = 'none';
        popover.progress.textContent = `Step ${step} of 5`;
        popover.nextButton.textContent = 'Try again';
        popover.nextButton.classList.add('soozi-tour-action');
        popover.nextButton.style.display = 'inline-flex';
        queueMicrotask(() => popover.nextButton.focus());
      },
    });
    this.driverInstance.highlight({
      popover: {
        title: 'Let’s try that again',
        description: message,
        showButtons: ['next', 'close'],
        showProgress: true,
        nextBtnText: 'Try again',
      },
    });
  }

  private needsContinueButton(step: FirstTourStep, element?: Element | null): boolean {
    if (step === 1 || step === 4) return true;
    if (step === 3 && element?.matches(FIRST_TOUR_SELECTORS.shoppingFallback)) return true;
    if (step === 3 && !element && !!document.querySelector(FIRST_TOUR_SELECTORS.shoppingFallback)) {
      return true;
    }
    return false;
  }

  private popoverClass(interactive: boolean): string {
    return interactive
      ? 'soozi-first-tour soozi-first-tour--dock-top'
      : 'soozi-first-tour soozi-first-tour--dock-bottom';
  }

  private visibleTarget(step: FirstTourStep): Element | null {
    const selector = this.selectorFor(step);
    return selector ? this.visibleElement(selector) : null;
  }

  private onNavigation(url: string): void {
    if (!this.active()) {
      const userId = this.auth.user()?.id;
      if (userId && url.startsWith('/dashboard')) void this.offerIfEligible(userId);
      return;
    }
    const expected = STEP_ROUTES[this.currentStep()];
    if (!url.startsWith(expected)) {
      this.destroy();
      return;
    }
    void this.showStep(this.currentStep());
  }

  private findTargetMeal() {
    const today = new Date().toISOString().slice(0, 10);
    return [...this.mealPlan.entries()]
      .filter((item) => item.date >= today && item.status === 'planned' && !!item.recipe_id)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }

  private waitForVisible(selector: string, timeoutMs = 5000): Promise<Element | null> {
    const immediate = this.visibleElement(selector);
    if (immediate) return Promise.resolve(immediate);
    return new Promise((resolve) => {
      const finish = (element: Element | null) => {
        this.clearWaiting();
        resolve(element);
      };
      this.observer = new MutationObserver(() => {
        const element = this.visibleElement(selector);
        if (element) finish(element);
      });
      this.observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      this.timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    });
  }

  private visibleElement(selector: string): Element | null {
    return [...document.querySelectorAll(selector)].find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    }) ?? null;
  }

  private clearWaiting(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.timeoutId !== null) window.clearTimeout(this.timeoutId);
    this.timeoutId = null;
  }
}

function elementIsFocusable(element: Element | undefined): element is HTMLElement {
  return element instanceof HTMLElement && !element.hasAttribute('disabled');
}
