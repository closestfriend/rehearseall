import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import PersonalBestTextInterviewChrome from './personal-best/TextInterviewChrome';
import TranscriptTextInterviewChrome from './transcript/TextInterviewChrome';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Props {
  roleLabel: string;
  levelLabel: string;
  messages: Message[];
  isTyping: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: (e: React.FormEvent) => void;
  onFinish: () => void;
  onCancel: () => void;
}

const ThemedTextInterviewChrome: React.FC<Props> = (props) => {
  const { theme } = useTheme();
  return theme === 'personal-best' ? <PersonalBestTextInterviewChrome {...props} /> : <TranscriptTextInterviewChrome {...props} />;
};

export default ThemedTextInterviewChrome;
