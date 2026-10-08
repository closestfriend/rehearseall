import type { VercelResponse } from '@vercel/node';

export type ErrorCode =
  | 'unauthorized'
  | 'quota_exceeded'
  | 'bad_request'
  | 'method_not_allowed'
  | 'origin_forbidden'
  | 'turn_limit'
  | 'upstream_error'
  | 'server_misconfigured';

const MESSAGES: Record<ErrorCode, string> = {
  unauthorized: 'Sign in is required to use rehearsal features.',
  quota_exceeded: 'You have reached your current rehearsal limit.',
  bad_request: 'The request was malformed.',
  method_not_allowed: 'Method not allowed.',
  origin_forbidden: 'This origin is not allowed to call the API.',
  turn_limit: 'This interview session has reached its maximum length.',
  upstream_error: 'The interview service is temporarily unavailable. Please try again.',
  server_misconfigured: 'The server is misconfigured. Please try again later.',
};

export function sendAuthError(res: VercelResponse, error: unknown): void {
  if (error instanceof Error && error.name === 'AuthError') {
    sendError(res, 401, 'unauthorized');
    return;
  }
  sendError(res, 500, 'server_misconfigured', error);
}

export function sendCommercialError(res: VercelResponse, error: unknown): void {
  if (error instanceof Error && (error as { code?: string }).code === 'quota_exceeded') {
    sendError(res, 429, 'quota_exceeded');
    return;
  }
  sendError(res, 500, 'server_misconfigured', error);
}

// Stable code + generic message to the client (spec C5); the detail goes to
// Vercel function logs — the error_logs table replaces this sink in phase 2.
export function sendError(
  res: VercelResponse,
  status: number,
  code: ErrorCode,
  logDetail?: unknown
): void {
  if (logDetail !== undefined) {
    console.error(`[gateway:${code}]`, logDetail);
  }
  res.status(status).json({ error: { code, message: MESSAGES[code] } });
}
