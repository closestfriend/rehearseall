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
  sessionId?: string;
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

export interface LiveSessionRequest {
  setup: PracticeSetup;
  /** Anti-repeat hint, initial mint only. */
  lastPersonaId?: string;
  /** Browser WebRTC SDP offer. */
  sdp: string;
}

export interface LiveSessionResponse {
  sessionId: string;
  personaId: string;
  personaName: string;
  sdp: string;
}

export interface LiveScreenFrameRequest {
  image: string;
}

export interface LiveScreenFrameResponse {
  description: string;
}
