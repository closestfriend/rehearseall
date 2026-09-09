import { describe, expect, it } from 'vitest';
import * as stageEffects from './stageEffects';
import { AppStage } from '../types';

const { resetStageScroll } = stageEffects;

describe('resetStageScroll', () => {
  it('returns the viewport to the top-left when a new app stage mounts', () => {
    const calls: unknown[] = [];
    resetStageScroll(value => calls.push(value));
    expect(calls).toEqual([{ top: 0, left: 0, behavior: 'auto' }]);
  });
});

describe('persistent home navigation', () => {
  it('adds the persistent control only where the page has no native home action', () => {
    const persistentHomeStages = Object.values(AppStage).filter(stage =>
      stageEffects.shouldShowHomeButton(stage)
    );

    expect(persistentHomeStages).toEqual([
      AppStage.REHEARSAL_LIBRARY,
      AppStage.INTERVIEW_MODE,
      AppStage.INTERVIEWING_TEXT,
      AppStage.INTERVIEWING_VOICE,
      AppStage.ASSESSMENT_ACTIVE,
    ]);
  });
});
