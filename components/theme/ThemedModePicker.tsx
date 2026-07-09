import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import PersonalBestModePicker from './personal-best/ModePicker';
import TranscriptModePicker from './transcript/ModePicker';

interface Props {
  roleLabel: string;
  levelLabel: string;
  mode: 'voice' | 'text';
  onModeChange: (m: 'voice' | 'text') => void;
  onStart: () => void;
  onBack: () => void; // back to Resume Upload
}

const ThemedModePicker: React.FC<Props> = (props) => {
  const { theme } = useTheme();
  return theme === 'personal-best' ? <PersonalBestModePicker {...props} /> : <TranscriptModePicker {...props} />;
};

export default ThemedModePicker;
