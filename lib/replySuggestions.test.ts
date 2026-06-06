import { describe, it, expect } from 'vitest';
import { mapSuggestionsToMessages, buildTranscriptMarkdown } from './replySuggestions';
import type { InterviewMessage, ReplySuggestion } from '../types';

const msg = (role: 'user' | 'assistant', content: string): InterviewMessage => ({ role, content, timestamp: 0 });
const sug = (replyIndex: number): ReplySuggestion => ({ replyIndex, critique: `c${replyIndex}`, modelAnswer: `m${replyIndex}` });

describe('mapSuggestionsToMessages', () => {
  it('attaches a suggestion to the matching user turn, not message index', () => {
    const transcript = [msg('assistant', 'Q1'), msg('user', 'A1'), msg('assistant', 'Q2'), msg('user', 'A2')];
    const out = mapSuggestionsToMessages(transcript, [sug(1)]);
    expect(out[0]).toBeNull();      // interviewer
    expect(out[1]).toBeNull();      // user turn 0 — no suggestion
    expect(out[2]).toBeNull();      // interviewer
    expect(out[3]).toEqual(sug(1)); // user turn 1 — matched
  });

  it('returns all null when suggestions is undefined', () => {
    expect(mapSuggestionsToMessages([msg('user', 'A1')], undefined)).toEqual([null]);
  });

  it('drops out-of-range replyIndex without throwing', () => {
    expect(mapSuggestionsToMessages([msg('user', 'A1')], [sug(5)])).toEqual([null]);
  });

  it('matches multiple suggestions across a longer transcript', () => {
    const transcript = [
      msg('assistant', 'Q1'), msg('user', 'A1'),
      msg('assistant', 'Q2'), msg('user', 'A2'),
      msg('assistant', 'Q3'), msg('user', 'A3'),
    ];
    const out = mapSuggestionsToMessages(transcript, [sug(0), sug(2)]);
    expect(out[1]).toEqual(sug(0)); // user turn 0
    expect(out[3]).toBeNull();      // user turn 1 — no suggestion
    expect(out[5]).toEqual(sug(2)); // user turn 2
  });

  it('returns an empty array for an empty transcript', () => {
    expect(mapSuggestionsToMessages([], [sug(0)])).toEqual([]);
  });
});

describe('buildTranscriptMarkdown', () => {
  it('interleaves a suggestion blockquote after the coached reply', () => {
    const transcript = [msg('assistant', 'Q1'), msg('user', 'A1')];
    const md = buildTranscriptMarkdown(transcript, [sug(0)]);
    expect(md).toBe(
      '**Interviewer:** Q1\n\n' +
      '**You:** A1\n\n' +
      '> **💡 Suggested improvement**\n' +
      '> **Why this fell short:** c0\n' +
      '> **Stronger answer:** m0'
    );
  });

  it('matches the plain format when there are no suggestions', () => {
    const transcript = [msg('assistant', 'Q1'), msg('user', 'A1')];
    expect(buildTranscriptMarkdown(transcript, undefined)).toBe('**Interviewer:** Q1\n\n**You:** A1');
  });
});
