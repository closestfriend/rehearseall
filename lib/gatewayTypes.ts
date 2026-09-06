import type {
  AssessmentAnswer,
  AssessmentDeck,
  PracticeSetup,
  RehearsalSetup,
  InterviewMessage,
  InterviewFeedback,
} from '../types';

// Request/response contracts for the /api gateway. Imported by both the
// Vercel functions and services/apiClient.ts — keep this file types-only.

export interface EvaluateRequest {
  setup: PracticeSetup;
  transcript: InterviewMessage[];
}
export type EvaluateResponse = InterviewFeedback;

export interface AssessmentDeckRequest {
  setup: RehearsalSetup;
}
export type AssessmentDeckResponse = AssessmentDeck;

export interface EvaluateAssessmentRequest {
  setup: RehearsalSetup;
  deck: AssessmentDeck;
  answers: AssessmentAnswer[];
}
export type EvaluateAssessmentResponse = InterviewFeedback;

export interface GatewayError {
  error: { code: string; message: string };
}

export interface ChatRequest {
  setup: PracticeSetup;
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

export interface LiveTokenRequest {
  setup: PracticeSetup;
  /** Anti-repeat hint, initial mint only. */
  lastPersonaId?: string;
  /** goAway reconnects need a fresh single-use token for the SAME persona. */
  reconnect?: boolean;
  /** Required when reconnect: true. */
  sessionId?: string;
  /** Required when reconnect: true. */
  personaId?: string;
}

export interface LiveTokenResponse {
  /** Ephemeral token name — used as the client apiKey with apiVersion v1alpha. */
  token: string;
  model: string;
  sessionId: string;
  personaId: string;
  personaName: string;
}
