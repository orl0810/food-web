import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { MealPlanAutogenerateResult } from '../models/meal-plan-autogenerate.model';
import { MealSlotItemStatus } from '../models/meal-slot-item.model';

export type FirstTourEvent =
  | { type: 'meal-plan-generated'; result: MealPlanAutogenerateResult }
  | { type: 'shopping-item-moved'; itemId: string }
  | { type: 'meal-status-persisted'; itemIds: string[]; status: MealSlotItemStatus };

@Injectable({ providedIn: 'root' })
export class FirstTourEventsService {
  private readonly eventSubject = new Subject<FirstTourEvent>();
  readonly events$ = this.eventSubject.asObservable();

  publish(event: FirstTourEvent): void {
    this.eventSubject.next(event);
  }
}

