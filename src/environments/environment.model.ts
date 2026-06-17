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
}
