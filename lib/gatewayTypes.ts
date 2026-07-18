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
