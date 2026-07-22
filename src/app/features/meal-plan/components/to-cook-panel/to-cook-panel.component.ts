import { Component, inject } from '@angular/core';
import { RecipeCookingDraft } from '../../../../core/models/recipe-cooking.model';
import { OverlayPageComponent } from '../../../../shared/components/overlay-page/overlay-page.component';
import { RecipeCookingDialogComponent } from '../../../../shared/components/recipe-cooking-dialog/recipe-cooking-dialog.component';
import { ToCookService } from '../../services/to-cook.service';
import { GroupedCookItem } from '../../utils/meal-slot-status.utils';
import { ToCookListComponent } from '../to-cook-list/to-cook-list.component';

@Component({
  selector: 'app-to-cook-panel',
  standalone: true,
  imports: [OverlayPageComponent, ToCookListComponent, RecipeCookingDialogComponent],
  template: `
    <app-overlay-page title="To cook" (backClick)="close()">
      <app-to-cook-list
        [groups]="toCookService.groupedItems()"
        [loading]="toCookService.loading()"
        [error]="toCookService.error()"
        [markingGroupKey]="toCookService.markingGroupKey()"
        (markNextReady)="onMarkNextReady($event)"
        (markAllReady)="onMarkAllReady($event)"
        (retry)="refresh()"
      />
    </app-overlay-page>

    @if (toCookService.cookingDraft(); as draft) {
      <app-recipe-cooking-dialog
        [draft]="draft"
        [busy]="toCookService.cookingBusy()"
        [error]="toCookService.cookingError()"
        (confirmed)="onCookingConfirmed($event)"
        (cancelled)="toCookService.closeCookingDialog()"
      />
    }
  `,
})
export class ToCookPanelComponent {
  readonly toCookService = inject(ToCookService);

  close(): void {
    this.toCookService.closePanel();
  }

  refresh(): void {
    void this.toCookService.refresh();
  }

  onMarkNextReady(group: GroupedCookItem): void {
    void this.toCookService.markNextReady(group);
  }

  onMarkAllReady(group: GroupedCookItem): void {
    void this.toCookService.markAllReady(group);
  }

  onCookingConfirmed(draft: RecipeCookingDraft): void {
    void this.toCookService.confirmCooking(draft);
  }
}
