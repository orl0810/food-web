import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { onboardingEntryGuard, pendingOnboardingGuard } from './core/guards/onboarding.guard';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/onboarding/components/onboarding-shell/onboarding-shell.component').then(
        (m) => m.OnboardingShellComponent
      ),
    canActivate: [authGuard, onboardingEntryGuard],
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard, pendingOnboardingGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory.component').then((m) => m.InventoryComponent),
      },
      {
        path: 'recipes',
        loadComponent: () =>
          import('./features/recipes/recipes.component').then((m) => m.RecipesComponent),
      },
      {
        path: 'recipes/new',
        loadComponent: () =>
          import('./features/recipes/recipe-form/recipe-form.component').then(
            (m) => m.RecipeFormComponent
          ),
      },
      {
        path: 'recipes/:id',
        loadComponent: () =>
          import('./features/recipes/recipe-detail/recipe-detail.component').then(
            (m) => m.RecipeDetailComponent
          ),
      },
      {
        path: 'recipes/:id/edit',
        loadComponent: () =>
          import('./features/recipes/recipe-form/recipe-form.component').then(
            (m) => m.RecipeFormComponent
          ),
      },
      {
        path: 'meal-plan',
        loadComponent: () =>
          import('./features/meal-plan/meal-plan.component').then((m) => m.MealPlanComponent),
      },
      {
        path: 'shopping-list',
        loadComponent: () =>
          import('./features/shopping-list/shopping-list.component').then(
            (m) => m.ShoppingListComponent
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/user-profile/components/user-profile-page/user-profile-page.component').then(
            (m) => m.UserProfilePageComponent
          ),
      },
      {
        path: 'suggestions',
        redirectTo: 'recipes',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
