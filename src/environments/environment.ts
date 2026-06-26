import type { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  useLocalApi: true,
  skipLogin: true,
  devUser: {
    email: 'dev@local.test',
    password: 'password',
  },
  localApiUrl: 'http://localhost:3001',
  supabaseUrl: 'https://gxkkwhrjlqpcjjzmvpcc.supabase.co',
  supabaseAnonKey: 'sb_publishable_DomMaeJ3jG48RQ37PDojZg_Oc_5ai5h',
  authSiteUrl: 'http://localhost:4200',
  recipeImagesBaseUrl: 'https://pub-1546545eadba4006adcbc01780aa2af2.r2.dev',
};
