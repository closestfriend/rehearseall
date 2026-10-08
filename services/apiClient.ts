import type { AssessmentAnswer, AssessmentDeck, PracticeSetup, RehearsalSetup, InterviewMessage } from '../types';
import type { AssessmentDeckRequest, AssessmentDeckResponse, EvaluateAssessmentRequest, EvaluateAssessmentResponse, GatewayError, ChatRequest, ChatResponse, EvaluateRequest, EvaluateResponse, LiveSessionRequest, LiveSessionResponse, LiveScreenFrameRequest, LiveScreenFrameResponse } from '../lib/gatewayTypes';
import { getSupabaseClient } from './supabase';
import type { HistoryEntry } from '../types';

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
    const session = (await getSupabaseClient()?.auth.getSession())?.data.session;
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
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
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const session = (await getSupabaseClient()?.auth.getSession())?.data.session;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  if (!res.ok) throw new GatewayRequestError('request_failed', `Request failed (${res.status}).`);
  return res.json() as Promise<T>;
}

async function remove(path: string, body: unknown): Promise<void> {
  const session = (await getSupabaseClient()?.auth.getSession())?.data.session;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new GatewayRequestError('request_failed', `Request failed (${res.status}).`);
}

export function evaluateInterview(
  setup: PracticeSetup,
  transcript: InterviewMessage[]
): Promise<EvaluateResponse> {
  const body: EvaluateRequest = { setup, transcript };
  return post<EvaluateResponse>('/api/evaluate', body);
}

export function sendChatTurn(body: ChatRequest): Promise<ChatResponse> {
  return post<ChatResponse>('/api/chat', body);
}

export function createLiveSession(body: LiveSessionRequest): Promise<LiveSessionResponse> {
  return post<LiveSessionResponse>('/api/live-session', body);
}

export function describeLiveScreenFrame(body: LiveScreenFrameRequest): Promise<LiveScreenFrameResponse> {
  return post<LiveScreenFrameResponse>('/api/live-screen-frame', body);
}

export function generateAssessmentDeck(setup: RehearsalSetup, sessionId?: string): Promise<AssessmentDeckResponse> {
  const body: AssessmentDeckRequest = { setup, sessionId };
  return post<AssessmentDeckResponse>('/api/assessment-deck', body);
}

export function evaluateAssessment(
  setup: RehearsalSetup,
  deck: AssessmentDeck,
  answers: AssessmentAnswer[],
): Promise<EvaluateAssessmentResponse> {
  const body: EvaluateAssessmentRequest = { setup, deck, answers };
  return post<EvaluateAssessmentResponse>('/api/evaluate-assessment', body);
}

export function getHistory(): Promise<{ history: HistoryEntry[] }> {
  return get<{ history: HistoryEntry[] }>('/api/history');
}

export function saveHistory(entry: HistoryEntry): Promise<void> {
  return post<void>('/api/history', entry);
}

export function deleteHistory(id: string): Promise<void> {
  return remove('/api/history', { id });
}

export function getAccount(): Promise<{ plan: 'free' | 'pro'; used: number; remaining: number | null }> {
  return get('/api/me');
}

export async function startCheckout(): Promise<void> {
  const result = await post<{ url?: string }>('/api/checkout', {});
  if (!result.url) throw new GatewayRequestError('checkout_unavailable', 'Checkout is not currently available.');
  window.location.assign(result.url);
}
