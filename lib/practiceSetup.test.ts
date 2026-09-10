import { describe, expect, it } from 'vitest';
import {
  isConversationSetup,
  isRehearsalSetup,
  practiceDetail,
  practiceLengthLabel,
  practicePersonaLabel,
  practiceTitle,
} from './practiceSetup';
import type { ConversationSetup, RehearsalSetup, ResumeData } from '../types';

const interview: ResumeData = {
  kind: 'interview',
  text: '',
  role: 'Research Scientist',
  experienceLevel: 'senior',
};

const conversation: ConversationSetup = {
  kind: 'conversation',
  title: 'AI use and teenagers',
  counterpart: "A physician at Nationwide Children's Hospital",
  goal: 'Have a useful interdisciplinary exchange.',
  context: 'I research AI harms.',
};

const rehearsal: RehearsalSetup = {
  kind: 'rehearsal',
  presetId: 'system-design-session',
  title: 'System Design Session',
  format: 'interview',
  domain: 'Software and systems',
  description: 'Design a system.',
  instructions: 'Probe architecture tradeoffs.',
  competencies: ['architecture'],
  guidance: ['add a scale constraint'],
  evaluationCriteria: ['tradeoff quality'],
  targetQuestionCount: 7,
  supportsScreenShare: true,
  participantContext: '',
};

describe('practice setup display helpers', () => {
  it('does not force an open conversation agenda into a generic 5–7-question label', () => {
    expect(practiceLengthLabel(conversation)).toBe('adaptive conversation');
    expect(practiceLengthLabel(rehearsal)).toBe('7 planned questions');
    expect(practiceLengthLabel(interview)).toBe('5–7 questions');
  });

  it('uses the target role and level for an interview rehearsal', () => {
    expect(practiceTitle(interview)).toBe('Research Scientist');
    expect(practiceDetail(interview)).toBe('senior');
  });

  it('uses the title and counterpart for an open rehearsal', () => {
    expect(isConversationSetup(conversation)).toBe(true);
    expect(practiceTitle(conversation)).toBe('AI use and teenagers');
    expect(practiceDetail(conversation)).toBe("A physician at Nationwide Children's Hospital");
  });

  it('uses the preset title and domain for a custom rehearsal', () => {
    expect(isRehearsalSetup(rehearsal)).toBe(true);
    expect(practiceTitle(rehearsal)).toBe('System Design Session');
    expect(practiceDetail(rehearsal)).toBe('Software and systems');
  });

  it('hides the synthetic persona label for structured assessments', () => {
    expect(
      practicePersonaLabel(
        { ...rehearsal, format: 'assessment' },
        'Structured assessment',
      ),
    ).toBeNull();
    expect(practicePersonaLabel(rehearsal, 'Systems interviewer')).toBe(
      'Systems interviewer',
    );
  });
});
