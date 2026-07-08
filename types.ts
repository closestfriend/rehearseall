
export interface ResumeData {
  text: string;
  role: string;
  experienceLevel: string;
  jobDescription?: string;
}

export interface InterviewMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ReplySuggestion {
  replyIndex: number;   // 0-based index over USER replies only, in order
  critique: string;     // what was weak — one or two sentences
  modelAnswer: string;  // a stronger version of the reply
}

export interface InterviewFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  detailedAnalysis: string;
  suggestions?: ReplySuggestion[];   // present only when score < 70; may be empty
}

export interface HistoryEntry {
  id: string;
  date: number;
  resume: ResumeData;
  transcript: InterviewMessage[];
  feedback: InterviewFeedback;
  personaName: string;
  mode?: 'voice' | 'text';   // absent on entries saved before this field existed
}

export enum AppStage {
  LANDING = 'LANDING',
  RESUME_UPLOAD = 'RESUME_UPLOAD',
  INTERVIEW_MODE = 'INTERVIEW_MODE',
  INTERVIEWING_TEXT = 'INTERVIEWING_TEXT',
  INTERVIEWING_VOICE = 'INTERVIEWING_VOICE',
  FEEDBACK = 'FEEDBACK',
  SESSION_LOG = 'SESSION_LOG'
}

export type Theme = 'personal-best' | 'transcript';
