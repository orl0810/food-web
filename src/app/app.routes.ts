import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { billingAvailableGuard } from './core/guards/billing.guard';
import { onboardingEntryGuard, pendingOnboardingGuard } from './core/guards/onboarding.guard';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing-page.component').then((m) => m.LandingPageComponent),
    pathMatch: 'full',
  },
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/components/login-page/login-page.component').then(
        (m) => m.LoginPageComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/components/auth-callback-page/auth-callback-page.component').then(
        (m) => m.AuthCallbackPageComponent
      ),
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/components/reset-password-page/reset-password-page.component').then(
        (m) => m.ResetPasswordPageComponent
      ),
  },
  {
    path: 'login',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/legal/privacy-policy-page.component').then(
        (m) => m.PrivacyPolicyPageComponent
      ),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./features/legal/terms-of-service-page.component').then(
        (m) => m.TermsOfServicePageComponent
      ),
  },
  {
    path: 'cookies',
    loadComponent: () =>
      import('./features/legal/cookie-policy-page.component').then(
        (m) => m.CookiePolicyPageComponent
      ),
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
        path: 'recipes/starter/:id',
        loadComponent: () =>
          import('./features/recipes/recipe-detail/recipe-detail.component').then(
            (m) => m.RecipeDetailComponent
          ),
        data: { starterMode: true },
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
        path: 'meal-plan/recent',
        loadComponent: () =>
          import('./features/meal-plan/meal-plan-recent-page/meal-plan-recent-page.component').then(
            (m) => m.MealPlanRecentPageComponent
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
        loadComponent: () =>
          import('./features/recipes/smart-suggestions-page/smart-suggestions-page.component').then(
            (m) => m.SmartSuggestionsPageComponent
          ),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: 'pricing',
        canActivate: [billingAvailableGuard],
        loadComponent: () =>
          import('./features/billing/pricing-page/pricing-page.component').then(
            (m) => m.PricingPageComponent
          ),
      },
      {
        path: 'account/billing',
        canActivate: [billingAvailableGuard],
        loadComponent: () =>
          import('./features/billing/account-billing-page/account-billing-page.component').then(
            (m) => m.AccountBillingPageComponent
          ),
      },
      {
        path: 'checkout/success',
        canActivate: [billingAvailableGuard],
        loadComponent: () =>
          import('./features/billing/checkout-success-page/checkout-success-page.component').then(
            (m) => m.CheckoutSuccessPageComponent
          ),
      },
      {
        path: 'checkout/cancel',
        canActivate: [billingAvailableGuard],
        loadComponent: () =>
          import('./features/billing/checkout-cancel-page/checkout-cancel-page.component').then(
            (m) => m.CheckoutCancelPageComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
