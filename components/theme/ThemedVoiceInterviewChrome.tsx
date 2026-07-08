import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import PersonalBestVoiceInterviewChrome from './personal-best/VoiceInterviewChrome';
import TranscriptVoiceInterviewChrome from './transcript/VoiceInterviewChrome';

interface Props {
  roleLabel: string;
  levelLabel: string;
  status: 'connecting' | 'listening' | 'speaking' | 'idle';
  isConnecting: boolean;
  volume: number;
  questionCount: number;
  totalQuestions: number;
  elapsedSeconds: number;
  liveTranscript: string;
  needsGesture: boolean;
  onBeginTap: () => void;
  cameraOn: boolean;
  cameraError: string | null;
  onToggleCamera: () => void;
  muted: boolean;
  onMute: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

const ThemedVoiceInterviewChrome: React.FC<Props> = (props) => {
  const { theme } = useTheme();
  return theme === 'personal-best' ? <PersonalBestVoiceInterviewChrome {...props} /> : <TranscriptVoiceInterviewChrome {...props} />;
};

export default ThemedVoiceInterviewChrome;
