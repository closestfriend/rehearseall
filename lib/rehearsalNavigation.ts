import { AppStage, type RehearsalSetup } from '../types';

export function destinationForRehearsal(setup: RehearsalSetup): AppStage {
  return setup.format === 'assessment'
    ? AppStage.ASSESSMENT_ACTIVE
    : AppStage.INTERVIEW_MODE;
}
