import { Component, inject } from '@angular/core';
import { FirstTourCoordinatorService } from './first-tour-coordinator.service';

@Component({
  selector: 'app-first-tour-host',
  standalone: true,
  template: '',
})
export class FirstTourHostComponent {
  private readonly coordinator = inject(FirstTourCoordinatorService);
}

