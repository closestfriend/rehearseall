import type { ResumeData, InterviewMessage, InterviewFeedback } from '../types';
import type { GatewayError, ChatRequest, ChatResponse, LiveTokenRequest, LiveTokenResponse } from '../lib/gatewayTypes';

// '' = same-origin (deployed + vercel dev). Set VITE_API_BASE to a deployed
// preview URL when running plain `npm run dev` / `npm run dev:phone`, which
// serve no /api functions.
const API_BASE = import.meta.env.VITE_API_BASE || '';

export class GatewayRequestError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'GatewayRequestError';
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GatewayRequestError('network', 'Could not reach the interview service. Check your connection and try again.');
  }
  if (!res.ok) {
    let code = 'unknown';
    let message = `Request failed (${res.status}).`;
    try {
      const parsed = (await res.json()) as GatewayError;
      if (parsed?.error?.code) ({ code, message } = parsed.error);
    } catch { /* non-JSON error body — keep the generic message */ }
    throw new GatewayRequestError(code, message);
  }
  return res.json() as Promise<T>;
}

export function evaluateInterview(
  setup: ResumeData,
  transcript: InterviewMessage[]
): Promise<InterviewFeedback> {
  return post<InterviewFeedback>('/api/evaluate', { setup, transcript });
}

export function sendChatTurn(body: ChatRequest): Promise<ChatResponse> {
  return post<ChatResponse>('/api/chat', body);
}

export function mintLiveToken(body: LiveTokenRequest): Promise<LiveTokenResponse> {
  return post<LiveTokenResponse>('/api/live-token', body);
}
