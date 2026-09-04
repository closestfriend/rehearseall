import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import PersonalBestConversationSetup from './personal-best/ConversationSetup';
import TranscriptConversationSetup from './transcript/ConversationSetup';

export interface ConversationSetupProps {
  title: string;
  onTitleChange: (value: string) => void;
  counterpart: string;
  onCounterpartChange: (value: string) => void;
  goal: string;
  onGoalChange: (value: string) => void;
  context: string;
  onContextChange: (value: string) => void;
  concern: string;
  onConcernChange: (value: string) => void;
  onLoadExample: () => void;
  onUseInterviewPreset: () => void;
  onContinue: () => void;
  onBackToHome: () => void;
}

const ThemedConversationSetup: React.FC<ConversationSetupProps> = (props) => {
  const { theme } = useTheme();
  return theme === 'personal-best'
    ? <PersonalBestConversationSetup {...props} />
    : <TranscriptConversationSetup {...props} />;
};

export default ThemedConversationSetup;
