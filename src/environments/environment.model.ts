export interface Environment {
  production: boolean;
  useLocalApi: boolean;
  skipLogin?: boolean;
  devUser?: {
    email: string;
    password: string;
  };
  localApiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Base app URL for auth redirects (no trailing slash). Falls back to window.location.origin in the browser. */
  authSiteUrl: string;
  /** Public CDN/custom domain for recipe images (no trailing slash). Empty = use image_url as-is. */
  recipeImagesBaseUrl: string;
  /**
   * When false, Angular NGSW is not registered.
   * Native Capacitor builds should set this to false to avoid asset-caching conflicts.
   */
  enableServiceWorker: boolean;
}
