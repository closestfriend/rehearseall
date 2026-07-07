import { describe, it, expect } from 'vitest';
import { parseLiveSessionSignal } from './liveSessionSignals';

describe('parseLiveSessionSignal', () => {
  it('flags goAway when present', () => {
    expect(parseLiveSessionSignal({ goAway: { timeLeft: '10s' } }).goAway).toBe(true);
  });

  it('does not flag goAway when absent', () => {
    expect(parseLiveSessionSignal({}).goAway).toBe(false);
  });

  it('captures a resumable handle', () => {
    const result = parseLiveSessionSignal({
      sessionResumptionUpdate: { resumable: true, newHandle: 'handle-123' }
    });
    expect(result.resumableHandle).toBe('handle-123');
  });

  it('ignores a handle marked not resumable', () => {
    const result = parseLiveSessionSignal({
      sessionResumptionUpdate: { resumable: false, newHandle: 'handle-123' }
    });
    expect(result.resumableHandle).toBeUndefined();
  });

  it('ignores a resumable update with no handle', () => {
    const result = parseLiveSessionSignal({
      sessionResumptionUpdate: { resumable: true }
    });
    expect(result.resumableHandle).toBeUndefined();
  });

  it('can report goAway and a resumable handle from the same message', () => {
    const result = parseLiveSessionSignal({
      goAway: { timeLeft: '5s' },
      sessionResumptionUpdate: { resumable: true, newHandle: 'handle-456' }
    });
    expect(result.goAway).toBe(true);
    expect(result.resumableHandle).toBe('handle-456');
  });
});
