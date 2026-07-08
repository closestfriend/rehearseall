import React from 'react';
import type { HistoryEntry } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import PersonalBestSessionLog from './personal-best/SessionLog';
import TranscriptSessionLog from './transcript/SessionLog';

interface Props {
  history: HistoryEntry[];
  onViewSession: (entry: HistoryEntry) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onStartInterview: () => void;
  onBackToHome: () => void;
}

const ThemedSessionLog: React.FC<Props> = (props) => {
  const { theme } = useTheme();
  return theme === 'personal-best' ? <PersonalBestSessionLog {...props} /> : <TranscriptSessionLog {...props} />;
};

export default ThemedSessionLog;
