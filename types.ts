
export interface ResumeData {
  text: string;
  role: string;
  experienceLevel: string;
}

export interface InterviewMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface InterviewFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  detailedAnalysis: string;
}

export interface HistoryEntry {
  id: string;
  date: number;
  resume: ResumeData;
  transcript: InterviewMessage[];
  feedback: InterviewFeedback;
}

export enum AppStage {
  LANDING = 'LANDING',
  RESUME_UPLOAD = 'RESUME_UPLOAD',
  INTERVIEW_MODE = 'INTERVIEW_MODE',
  INTERVIEWING_TEXT = 'INTERVIEWING_TEXT',
  INTERVIEWING_VOICE = 'INTERVIEWING_VOICE',
  FEEDBACK = 'FEEDBACK'
}
