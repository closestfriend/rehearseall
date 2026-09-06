import { describe, expect, it } from 'vitest';
import { resetStageScroll } from './stageEffects';

describe('resetStageScroll', () => {
  it('returns the viewport to the top-left when a new app stage mounts', () => {
    const calls: unknown[] = [];
    resetStageScroll(value => calls.push(value));
    expect(calls).toEqual([{ top: 0, left: 0, behavior: 'auto' }]);
  });
});
