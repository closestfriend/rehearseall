import { AppStage, type ConversationSetup, type RehearsalSetup } from '../types';

export function destinationForRehearsal(setup: RehearsalSetup): AppStage {
  return setup.format === 'assessment'
    ? AppStage.ASSESSMENT_ACTIVE
    : AppStage.INTERVIEW_MODE;
}

export function destinationForPreloadedPractice(
  setup: ConversationSetup | RehearsalSetup,
): AppStage {
  return setup.kind === 'conversation'
    ? AppStage.INTERVIEW_MODE
    : destinationForRehearsal(setup);
}
