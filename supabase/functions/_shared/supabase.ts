import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0';

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export function createUserClient(authHeader: string): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });
}

export function createServiceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

export async function getAuthenticatedUserId(authHeader: string | null): Promise<string> {
  if (!authHeader) {
    throw new Error('UNAUTHENTICATED');
  }
  const supabase = createUserClient(authHeader);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('UNAUTHENTICATED');
  }
  return data.user.id;
}

export async function assertAdmin(authHeader: string): Promise<string> {
  const userId = await getAuthenticatedUserId(authHeader);
  const supabase = createUserClient(authHeader);
  const { data, error } = await supabase.rpc('is_admin');
  if (error || !data) {
    throw new Error('ACCESS_DENIED');
  }
  return userId;
}
