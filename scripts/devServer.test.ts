import { describe, expect, it } from 'vitest';
import { apiModuleForPath } from './devServer';

describe('apiModuleForPath', () => {
  it('maps supported local API routes to their handlers', () => {
    expect(apiModuleForPath('/api/health')).toBe('/api/health.ts');
    expect(apiModuleForPath('/api/chat')).toBe('/api/chat.ts');
    expect(apiModuleForPath('/api/evaluate')).toBe('/api/evaluate.ts');
    expect(apiModuleForPath('/api/assessment-deck')).toBe('/api/assessment-deck.ts');
    expect(apiModuleForPath('/api/evaluate-assessment')).toBe('/api/evaluate-assessment.ts');
    expect(apiModuleForPath('/api/live-token')).toBe('/api/live-token.ts');
  });

  it('does not claim frontend or unknown API routes', () => {
    expect(apiModuleForPath('/')).toBeNull();
    expect(apiModuleForPath('/api/unknown')).toBeNull();
  });
});
