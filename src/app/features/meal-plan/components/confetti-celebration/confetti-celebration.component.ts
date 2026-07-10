import { Component, effect, input, OnDestroy, signal } from '@angular/core';

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
}

const CONFETTI_COLORS = ['#16a34a', '#22c55e', '#d97706', '#82af81', '#15803d', '#fbbf24'];
const PIECE_COUNT = 28;
const DURATION_MS = 1000;

@Component({
  selector: 'app-confetti-celebration',
  standalone: true,
  template: `
    @if (visible() && !reducedMotion()) {
      <div
        class="confetti-overlay pointer-events-none fixed inset-0 z-overlay overflow-hidden"
        aria-hidden="true"
      >
        @for (piece of pieces(); track piece.id) {
          <span
            class="confetti-piece absolute top-0 block rounded-sm"
            [style.left.%]="piece.left"
            [style.width.px]="piece.size"
            [style.height.px]="piece.size * 0.6"
            [style.background-color]="piece.color"
            [style.animation-delay.ms]="piece.delay"
            [style.animation-duration.ms]="piece.duration"
            [style.--rotation]="piece.rotation + 'deg'"
          ></span>
        }
      </div>
    }
  `,
  styles: `
    .confetti-piece {
      animation: confetti-fall linear forwards;
      transform: rotate(var(--rotation, 0deg));
    }

    @keyframes confetti-fall {
      0% {
        opacity: 1;
        transform: translateY(-10px) rotate(var(--rotation, 0deg));
      }
      100% {
        opacity: 0;
        transform: translateY(100vh) rotate(calc(var(--rotation, 0deg) + 360deg));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .confetti-piece {
        animation: none;
        display: none;
      }
    }
  `,
})
export class ConfettiCelebrationComponent implements OnDestroy {
  readonly active = input(false);

  readonly visible = signal(false);
  readonly pieces = signal<ConfettiPiece[]>([]);

  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly reducedMotion = signal(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  constructor() {
    effect(() => {
      if (this.active()) {
        this.launch();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private launch(): void {
    if (this.reducedMotion()) {
      return;
    }

    this.clearTimer();
    this.pieces.set(this.createPieces());
    this.visible.set(true);

    this.hideTimer = setTimeout(() => {
      this.visible.set(false);
      this.pieces.set([]);
    }, DURATION_MS);
  }

  private createPieces(): ConfettiPiece[] {
    return Array.from({ length: PIECE_COUNT }, (_, index) => ({
      id: index,
      left: Math.random() * 100,
      delay: Math.random() * 200,
      duration: 700 + Math.random() * 400,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 6,
      rotation: Math.random() * 360,
    }));
  }

  private clearTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
