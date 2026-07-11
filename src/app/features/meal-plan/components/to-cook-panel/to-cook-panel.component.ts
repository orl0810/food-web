import { Component, inject } from '@angular/core';
import { OverlayPageComponent } from '../../../../shared/components/overlay-page/overlay-page.component';
import { ToCookService } from '../../services/to-cook.service';
import { GroupedCookItem } from '../../utils/meal-slot-status.utils';
import { ToCookListComponent } from '../to-cook-list/to-cook-list.component';

@Component({
  selector: 'app-to-cook-panel',
  standalone: true,
  imports: [OverlayPageComponent, ToCookListComponent],
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
}
