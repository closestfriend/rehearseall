import type { ResumeData, InterviewMessage, InterviewFeedback } from '../types';

// Request/response contracts for the /api gateway. Imported by both the
// Vercel functions and services/apiClient.ts — keep this file types-only.

export interface EvaluateRequest {
  setup: ResumeData;
  transcript: InterviewMessage[];
}
export type EvaluateResponse = InterviewFeedback;

export interface GatewayError {
  error: { code: string; message: string };
}

export interface ChatRequest {
  setup: ResumeData;
  /** Full history so far (client-rendered shape); [] on the first turn. */
  messages: InterviewMessage[];
  /** Echo of the first response's sessionId on subsequent turns. */
  sessionId?: string;
  /** Echo of the first response's personaId — keeps the persona stable per session. */
  personaId?: string;
  /** Anti-repeat hint (localStorage), meaningful on the first turn only. */
  lastPersonaId?: string;
}

export interface ChatResponse {
  sessionId: string;
  personaId: string;
  personaName: string;
  reply: string;
}
