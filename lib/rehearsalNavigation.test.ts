import { describe, expect, it } from 'vitest';
import { AppStage, type ConversationSetup, type RehearsalSetup } from '../types';
import { destinationForPreloadedPractice, destinationForRehearsal } from './rehearsalNavigation';

const setup = (format: RehearsalSetup['format']): RehearsalSetup => ({
  kind: 'rehearsal', presetId: 'practice', title: 'Practice', format,
  domain: 'General', description: 'A practice run.', instructions: 'Run it.',
  competencies: ['reasoning'], guidance: ['follow up'], evaluationCriteria: ['clarity'],
  targetQuestionCount: 4, supportsScreenShare: false, participantContext: '',
});

describe('destinationForRehearsal', () => {
  it('sends adaptive interviews to the existing mode picker', () => {
    expect(destinationForRehearsal(setup('interview'))).toBe(AppStage.INTERVIEW_MODE);
  });

  it('sends structured formats to the assessment runner', () => {
    expect(destinationForRehearsal(setup('assessment'))).toBe(AppStage.ASSESSMENT_ACTIVE);
  });

  it('sends a preloaded conversation directly to the voice-or-text picker', () => {
    const conversation: ConversationSetup = {
      kind: 'conversation',
      title: 'Prepared call',
      counterpart: 'A collaborator',
      goal: 'Practice the conversation.',
      context: 'A complete brief is already loaded.',
    };
    expect(destinationForPreloadedPractice(conversation)).toBe(AppStage.INTERVIEW_MODE);
  });
});
