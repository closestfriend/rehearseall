import type { ConversationSetup, PracticeSetup } from '../types';

export function isConversationSetup(
  setup: PracticeSetup,
): setup is ConversationSetup {
  return setup.kind === 'conversation';
}

export function practiceTitle(setup: PracticeSetup): string {
  return isConversationSetup(setup) ? setup.title : setup.role;
}

export function practiceDetail(setup: PracticeSetup): string {
  return isConversationSetup(setup)
    ? setup.counterpart
    : setup.experienceLevel;
}
