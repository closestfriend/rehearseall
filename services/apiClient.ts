import type { AssessmentAnswer, AssessmentDeck, PracticeSetup, RehearsalSetup, InterviewMessage } from '../types';
import type { AssessmentDeckRequest, AssessmentDeckResponse, EvaluateAssessmentRequest, EvaluateAssessmentResponse, GatewayError, ChatRequest, ChatResponse, EvaluateRequest, EvaluateResponse, LiveTokenRequest, LiveTokenResponse } from '../lib/gatewayTypes';

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
  setup: PracticeSetup,
  transcript: InterviewMessage[]
): Promise<EvaluateResponse> {
  const body: EvaluateRequest = { setup, transcript };
  return post<EvaluateResponse>('/api/evaluate', body);
}

export function sendChatTurn(body: ChatRequest): Promise<ChatResponse> {
  return post<ChatResponse>('/api/chat', body);
}

export function mintLiveToken(body: LiveTokenRequest): Promise<LiveTokenResponse> {
  return post<LiveTokenResponse>('/api/live-token', body);
}

export function generateAssessmentDeck(setup: RehearsalSetup): Promise<AssessmentDeckResponse> {
  const body: AssessmentDeckRequest = { setup };
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
