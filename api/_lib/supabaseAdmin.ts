export class PersistenceError extends Error {
  readonly code = 'persistence_error';

  constructor(message: string) {
    super(message);
    this.name = 'PersistenceError';
  }
}

function adminConfig(): { baseUrl: string; serviceKey: string } {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new PersistenceError('Supabase server configuration is incomplete');
  return { baseUrl, serviceKey };
}

export async function supabaseAdmin<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: T | null }> {
  const { baseUrl, serviceKey } = adminConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    console.error('[persistence:unreachable]', error);
    throw new PersistenceError('Persistence provider unavailable');
  }
  const text = await response.text();
  let body: T | null = null;
  if (text) {
    try { body = JSON.parse(text) as T; } catch { /* body is intentionally ignored */ }
  }
  return { response, body };
}

export function ensurePersistenceOk(response: Response, operation: string): void {
  if (!response.ok) {
    console.error(`[persistence:${operation}]`, response.status);
    throw new PersistenceError(`Persistence operation failed: ${operation}`);
  }
}
