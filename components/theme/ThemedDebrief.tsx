import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import PersonalBestDebrief from './personal-best/Debrief';
import TranscriptDebrief from './transcript/Debrief';
import type { DebriefProps } from './personal-best/Debrief';

const ThemedDebrief: React.FC<DebriefProps> = (props) => {
  const { theme } = useTheme();
  return theme === 'personal-best' ? <PersonalBestDebrief {...props} /> : <TranscriptDebrief {...props} />;
};

export default ThemedDebrief;
export type { DebriefProps };
