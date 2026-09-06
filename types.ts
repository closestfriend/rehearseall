
export interface ResumeData {
  kind?: 'interview';
  text: string;
  role: string;
  experienceLevel: string;
  jobDescription?: string;
}

export interface ConversationSetup {
  kind: 'conversation';
  title: string;
  counterpart: string;
  goal: string;
  context: string;
  concern?: string;
}

export type RehearsalFormat = 'interview' | 'assessment';

export interface RehearsalPreset {
  id: string;
  title: string;
  collection: 'practice';
  domain: string;
  format: RehearsalFormat;
  listedDurationMinutes?: number;
  listedQuestionCount?: number;
  practiceQuestionCount: number;
  description: string;
  instructions: string;
  competencies: string[];
  guidance: string[];
  evaluationCriteria: string[];
  supportsScreenShare: boolean;
  sourceConfidence: 'title-only';
}

export interface RehearsalSetup {
  kind: 'rehearsal';
  presetId: string;
  title: string;
  format: RehearsalFormat;
  domain: string;
  description: string;
  instructions: string;
  competencies: string[];
  guidance: string[];
  evaluationCriteria: string[];
  targetQuestionCount: number;
  supportsScreenShare: boolean;
  participantContext: string;
}

export type AssessmentQuestionType =
  | 'single-choice'
  | 'multiple-choice'
  | 'short-text'
  | 'long-text';

export interface AssessmentQuestion {
  id: string;
  type: AssessmentQuestionType;
  prompt: string;
  stimulus?: string;
  options?: string[];
  answerKey?: string[];
  evaluationCriteria: string[];
  rationale: string;
}

export interface AssessmentDeck {
  title: string;
  instructions: string;
  questions: AssessmentQuestion[];
}

export interface AssessmentAnswer {
  questionId: string;
  value: string | string[];
}

export type PracticeSetup = ResumeData | ConversationSetup | RehearsalSetup;

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
  /** `resume` is retained for compatibility with existing local history. */
  resume: PracticeSetup;
  transcript: InterviewMessage[];
  feedback: InterviewFeedback;
  personaName: string;
  mode?: 'voice' | 'text';   // absent on entries saved before this field existed
}

export enum AppStage {
  LANDING = 'LANDING',
  REHEARSAL_LIBRARY = 'REHEARSAL_LIBRARY',
  RESUME_UPLOAD = 'RESUME_UPLOAD',
  INTERVIEW_MODE = 'INTERVIEW_MODE',
  INTERVIEWING_TEXT = 'INTERVIEWING_TEXT',
  INTERVIEWING_VOICE = 'INTERVIEWING_VOICE',
  ASSESSMENT_ACTIVE = 'ASSESSMENT_ACTIVE',
  FEEDBACK = 'FEEDBACK',
  SESSION_LOG = 'SESSION_LOG'
}

export type Theme = 'personal-best' | 'transcript';
