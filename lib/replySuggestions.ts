import type { InterviewMessage, ReplySuggestion } from '../types';

/**
 * Align suggestions to transcript messages. Returns an array the same length as
 * `transcript`; each entry is the ReplySuggestion whose `replyIndex` matches
 * that message's 0-based user-turn position, or null. Non-user messages and
 * out-of-range indices yield null (out-of-range suggestions are dropped).
 */
export function mapSuggestionsToMessages(
  transcript: InterviewMessage[],
  suggestions: ReplySuggestion[] | undefined,
): (ReplySuggestion | null)[] {
  const byIndex = new Map<number, ReplySuggestion>();
  (suggestions ?? []).forEach(s => byIndex.set(s.replyIndex, s));
  // User-turn counting mirrors api/_lib/transcriptFormat.ts on purpose: both must
  // use the identical 0-based "count only user messages" contract. Kept
  // separate because the output shapes differ (string vs. aligned array).
  let userTurn = -1;
  return transcript.map(m => {
    if (m.role !== 'user') return null;
    userTurn += 1;
    return byIndex.get(userTurn) ?? null;
  });
}

/**
 * Build the Markdown transcript section, interleaving each suggestion as a
 * blockquote after the reply it coaches.
 */
export function buildTranscriptMarkdown(
  transcript: InterviewMessage[],
  suggestions: ReplySuggestion[] | undefined,
): string {
  const matched = mapSuggestionsToMessages(transcript, suggestions);
  return transcript
    .map((m, i) => {
      const speaker = m.role === 'user' ? '**You:**' : '**Interviewer:**';
      let block = `${speaker} ${m.content}`;
      const s = matched[i];
      if (s) {
        block +=
          `\n\n> **💡 Suggested improvement**\n` +
          `> **Why this fell short:** ${s.critique}\n` +
          `> **Stronger answer:** ${s.modelAnswer}`;
      }
      return block;
    })
    .join('\n\n');
}
