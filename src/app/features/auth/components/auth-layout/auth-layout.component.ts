import { Component } from '@angular/core';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <ng-content />
    </div>
  `,
})
export class AuthLayoutComponent {}
