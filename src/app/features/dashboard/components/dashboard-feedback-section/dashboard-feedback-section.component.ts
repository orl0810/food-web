import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FeedbackService } from '../../../../core/services/feedback.service';
import { StarRatingComponent } from '../../../../shared/components/star-rating/star-rating.component';

const MAX_COMMENT_LENGTH = 1000;

@Component({
  selector: 'app-dashboard-feedback-section',
  standalone: true,
  imports: [ReactiveFormsModule, StarRatingComponent],
  template: `
    <section class="card mt-8 p-5" aria-labelledby="dashboard-feedback-title">
      @if (submitted()) {
        <div class="flex items-start gap-3" role="status" aria-live="polite">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base"
            aria-hidden="true"
          >
            ✓
          </span>
          <div>
            <h2 id="dashboard-feedback-title" class="section-title">Thanks for your feedback!</h2>
            <p class="mt-1 text-sm text-stone-600">
              Your input helps improve Soozi. You can share more feedback anytime.
            </p>
            <button type="button" class="btn-secondary-sm mt-4" (click)="resetForm()">
              Send more feedback
            </button>
          </div>
        </div>
      } @else {
        <h2 id="dashboard-feedback-title" class="section-title">Help improve Soozi</h2>
        <p class="mt-1 text-sm text-stone-600">
          How is your experience so far? Rate the app and optionally tell us what to improve.
        </p>

        <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
          <div>
            <span class="mb-2 block text-sm font-medium text-stone-700">Your rating</span>
            <app-star-rating
              [rating]="rating()"
              size="md"
              (ratingChange)="onRatingChange($event)"
            />
            @if (rating() === null) {
              <p class="mt-1 text-xs text-stone-500">Select 1–5 stars to submit.</p>
            }
          </div>

          <label class="block">
            <span class="mb-1 block text-sm font-medium text-stone-700">
              Comments <span class="font-normal text-stone-500">(optional)</span>
            </span>
            <textarea
              id="feedback-comment"
              rows="3"
              class="input w-full resize-y"
              formControlName="comment"
              placeholder="What do you like? What could be better?"
              [attr.maxlength]="maxCommentLength"
            ></textarea>
            <p class="mt-1 text-xs text-stone-500">
              {{ commentLength() }}/{{ maxCommentLength }} characters
            </p>
          </label>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              class="btn-primary-sm"
              [disabled]="rating() === null || feedbackService.submitting()"
            >
              {{ feedbackService.submitting() ? 'Sending…' : 'Send feedback' }}
            </button>
            @if (feedbackService.error()) {
              <span class="text-sm text-red-600" role="alert">{{ feedbackService.error() }}</span>
            }
          </div>
        </form>
      }
    </section>
  `,
})
export class DashboardFeedbackSectionComponent {
  readonly feedbackService = inject(FeedbackService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly maxCommentLength = MAX_COMMENT_LENGTH;
  readonly rating = signal<number | null>(null);
  readonly submitted = signal(false);

  readonly form = this.formBuilder.group({
    comment: ['', [Validators.maxLength(MAX_COMMENT_LENGTH)]],
  });

  commentLength(): number {
    return this.form.controls.comment.value?.length ?? 0;
  }

  onRatingChange(value: number | null): void {
    this.rating.set(value);
  }

  async submit(): Promise<void> {
    const selectedRating = this.rating();
    if (selectedRating === null || this.feedbackService.submitting()) {
      return;
    }

    const comment = this.form.controls.comment.value?.trim() || null;
    const { error } = await this.feedbackService.submitFeedback({
      rating: selectedRating,
      comment,
      app_context: this.router.url,
    });

    if (!error) {
      this.submitted.set(true);
    }
  }

  resetForm(): void {
    this.rating.set(null);
    this.form.reset({ comment: '' });
    this.submitted.set(false);
  }
}
