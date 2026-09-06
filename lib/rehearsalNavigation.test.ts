import { describe, expect, it } from 'vitest';
import { AppStage, type RehearsalSetup } from '../types';
import { destinationForRehearsal } from './rehearsalNavigation';

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
});
