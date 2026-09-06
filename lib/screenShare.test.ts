import { describe, expect, it } from 'vitest';
import type { RehearsalSetup, ResumeData } from '../types';
import { canShareScreen, captureScreenFrame, stripDataUrlPrefix } from './screenShare';

const rehearsal: RehearsalSetup = {
  kind: 'rehearsal', presetId: 'demo', title: 'Demo', format: 'interview', domain: 'Software',
  description: 'Demo work.', instructions: 'Show it.', competencies: ['demo'], guidance: ['probe'],
  evaluationCriteria: ['clarity'], targetQuestionCount: 4, supportsScreenShare: true, participantContext: '',
};

describe('screen sharing helpers', () => {
  it('offers screen sharing only for enabled rehearsal setups in a capable browser', () => {
    const capable = { getDisplayMedia: () => Promise.resolve({}) };
    const resume: ResumeData = { text: '', role: 'Engineer', experienceLevel: 'mid' };
    expect(canShareScreen(rehearsal, capable)).toBe(true);
    expect(canShareScreen({ ...rehearsal, supportsScreenShare: false }, capable)).toBe(false);
    expect(canShareScreen(resume, capable)).toBe(false);
    expect(canShareScreen(rehearsal, {})).toBe(false);
  });

  it('removes a data URL header without changing an already raw payload', () => {
    expect(stripDataUrlPrefix('data:image/jpeg;base64,abc123')).toBe('abc123');
    expect(stripDataUrlPrefix('abc123')).toBe('abc123');
  });

  it('captures a bounded JPEG frame and returns only its base64 payload', () => {
    let drawn = false;
    const video = { videoWidth: 1920, videoHeight: 1080, readyState: 4 } as HTMLVideoElement;
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => { drawn = true; } }),
      toDataURL: () => 'data:image/jpeg;base64,frame-data',
    } as unknown as HTMLCanvasElement;

    expect(captureScreenFrame(video, canvas)).toBe('frame-data');
    expect(drawn).toBe(true);
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
  });

  it('does not capture before the display video has dimensions', () => {
    const video = { videoWidth: 0, videoHeight: 0, readyState: 0 } as HTMLVideoElement;
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(captureScreenFrame(video, canvas)).toBeNull();
  });
});
