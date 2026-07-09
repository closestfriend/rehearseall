import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import PersonalBestResumeUpload from './personal-best/ResumeUpload';
import TranscriptResumeUpload from './transcript/ResumeUpload';

interface Props {
  role: string;
  onRoleChange: (v: string) => void;
  level: string; // 'junior' | 'mid' | 'senior' | 'staff+'
  onLevelChange: (v: string) => void;
  jobDescription: string;
  onJobDescriptionChange: (v: string) => void;
  resumeText: string; // paste-fallback textarea content
  onResumeTextChange: (v: string) => void;
  uploadedFileName: string | null;
  parseState: 'idle' | 'parsing' | 'error';
  parseSummary: string | null; // honest summary line for the confirmation panel
  onFileSelected: (file: File) => void;
  onFileClear: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onBackToHome: () => void;
}

const ThemedResumeUpload: React.FC<Props> = (props) => {
  const { theme } = useTheme();
  return theme === 'personal-best' ? <PersonalBestResumeUpload {...props} /> : <TranscriptResumeUpload {...props} />;
};

export default ThemedResumeUpload;
