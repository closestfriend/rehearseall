import { describe, expect, it } from 'vitest';
import { ThinkingLevel } from '@google/genai';
import { MODEL_ROUTES, generationConfig } from './modelRouting';

describe('Gemini model routing', () => {
  it('uses the strongest Flash model at low latency for live text turns', () => {
    expect(MODEL_ROUTES.INTERACTIVE.chain).toEqual([
      'gemini-3.8-flash',
      'gemini-3.7-flash',
    ]);
    expect(generationConfig(MODEL_ROUTES.INTERACTIVE)).toEqual({
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    });
  });

  it('gives assessment generation balanced thinking on the strongest Flash models', () => {
    expect(MODEL_ROUTES.ASSESSMENT_DECK.chain).toEqual([
      'gemini-3.8-flash',
      'gemini-3.7-flash',
    ]);
    expect(generationConfig(MODEL_ROUTES.ASSESSMENT_DECK)).toEqual({
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    });
  });

  it('gives debriefs balanced thinking on the strongest Flash models', () => {
    expect(MODEL_ROUTES.EVALUATION.chain).toEqual([
      'gemini-3.8-flash',
      'gemini-3.7-flash',
    ]);
    expect(generationConfig(MODEL_ROUTES.EVALUATION)).toEqual({
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    });
  });

  it('keeps the current low-latency native-audio Live model', () => {
    expect(MODEL_ROUTES.LIVE.model).toBe('gemini-3.1-flash-live-preview');
  });

  it('does not add deprecated sampling controls', () => {
    expect(generationConfig(MODEL_ROUTES.ASSESSMENT_DECK)).not.toHaveProperty('temperature');
    expect(generationConfig(MODEL_ROUTES.ASSESSMENT_DECK)).not.toHaveProperty('topP');
    expect(generationConfig(MODEL_ROUTES.ASSESSMENT_DECK)).not.toHaveProperty('topK');
  });
});
