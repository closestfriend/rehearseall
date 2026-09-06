import React from 'react';
import type { HistoryEntry } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import PersonalBestHome from './personal-best/Home';
import TranscriptHome from './transcript/Home';

interface Props {
  history: HistoryEntry[];
  onStartInterview: () => void;
  onBrowseRehearsals: () => void;
  onViewSession: (entry: HistoryEntry) => void;
  onViewSessionLog: () => void;
}

const ThemedHome: React.FC<Props> = (props) => {
  const { theme } = useTheme();
  return theme === 'personal-best' ? <PersonalBestHome {...props} /> : <TranscriptHome {...props} />;
};

export default ThemedHome;
