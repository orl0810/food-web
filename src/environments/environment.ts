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
};
