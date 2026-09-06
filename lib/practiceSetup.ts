import type { ConversationSetup, PracticeSetup, RehearsalSetup } from '../types';

export function isConversationSetup(
  setup: PracticeSetup,
): setup is ConversationSetup {
  return setup.kind === 'conversation';
}

export function isRehearsalSetup(
  setup: PracticeSetup,
): setup is RehearsalSetup {
  return setup.kind === 'rehearsal';
}

export function practiceTitle(setup: PracticeSetup): string {
  return isConversationSetup(setup) || isRehearsalSetup(setup) ? setup.title : setup.role;
}

export function practiceDetail(setup: PracticeSetup): string {
  if (isConversationSetup(setup)) return setup.counterpart;
  if (isRehearsalSetup(setup)) return setup.domain;
  return setup.experienceLevel;
}

export function practicePersonaLabel(
  setup: PracticeSetup,
  personaName?: string,
): string | null {
  if (isRehearsalSetup(setup) && setup.format === 'assessment') return null;
  return personaName ?? null;
}
