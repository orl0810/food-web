const DEFAULT_LOCAL_ORIGINS = ['http://localhost:4200', 'http://127.0.0.1:4200'];

export function getAllowedOrigins(): string[] {
  const appBaseUrl = Deno.env.get('APP_BASE_URL');
  const origins = [...DEFAULT_LOCAL_ORIGINS];
  if (appBaseUrl) {
    try {
      const parsed = new URL(appBaseUrl);
      origins.push(parsed.origin);
    } catch {
      // ignore invalid APP_BASE_URL
    }
  }
  return [...new Set(origins)];
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();
  const resolvedOrigin =
    origin && allowed.includes(origin) ? origin : allowed[allowed.length - 1] ?? '*';

  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get('Origin')),
    });
  }
  return null;
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req.headers.get('Origin')),
      'Content-Type': 'application/json',
    },
  });
}
