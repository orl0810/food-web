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
}
