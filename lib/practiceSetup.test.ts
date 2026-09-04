import { describe, expect, it } from 'vitest';
import { isConversationSetup, practiceDetail, practiceTitle } from './practiceSetup';
import type { ConversationSetup, ResumeData } from '../types';

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

describe('practice setup display helpers', () => {
  it('uses the target role and level for an interview rehearsal', () => {
    expect(practiceTitle(interview)).toBe('Research Scientist');
    expect(practiceDetail(interview)).toBe('senior');
  });

  it('uses the title and counterpart for an open rehearsal', () => {
    expect(isConversationSetup(conversation)).toBe(true);
    expect(practiceTitle(conversation)).toBe('AI use and teenagers');
    expect(practiceDetail(conversation)).toBe("A physician at Nationwide Children's Hospital");
  });
});
