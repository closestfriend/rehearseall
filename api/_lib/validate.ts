import type { ConversationSetup, PracticeSetup, ResumeData, InterviewMessage } from '../../types';

export const LIMITS = {
  resumeChars: 30_000,
  jdChars: 10_000,
  roleChars: 200,
  levelChars: 40,
  titleChars: 200,
  counterpartChars: 300,
  goalChars: 2_000,
  contextChars: 12_000,
  concernChars: 4_000,
  messageChars: 8_000,
  // Spec C7's phase-1 ceiling: 40 interviewer turns per session, enforced on
  // the client-supplied history length. A client can lie by trimming history,
  // but then the interview loses its context — real enforcement lands with
  // usage_events in phase 3.
  maxTurns: 40,
};

export type Validated<T> = { ok: true; value: T } | { ok: false; reason: string };

export function validateSetup(raw: unknown): Validated<PracticeSetup> {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'setup missing' };
  const s = raw as Record<string, unknown>;
  if (s.kind === 'conversation') {
    if (typeof s.title !== 'string' || !s.title.trim() || s.title.length > LIMITS.titleChars)
      return { ok: false, reason: 'setup.title' };
    if (typeof s.counterpart !== 'string' || !s.counterpart.trim() || s.counterpart.length > LIMITS.counterpartChars)
      return { ok: false, reason: 'setup.counterpart' };
    if (typeof s.goal !== 'string' || !s.goal.trim() || s.goal.length > LIMITS.goalChars)
      return { ok: false, reason: 'setup.goal' };
    if (typeof s.context !== 'string' || s.context.length > LIMITS.contextChars)
      return { ok: false, reason: 'setup.context' };
    if (s.concern !== undefined && (typeof s.concern !== 'string' || s.concern.length > LIMITS.concernChars))
      return { ok: false, reason: 'setup.concern' };
    return {
      ok: true,
      value: {
        kind: 'conversation',
        title: s.title,
        counterpart: s.counterpart,
        goal: s.goal,
        context: s.context,
        concern: s.concern as string | undefined,
      } satisfies ConversationSetup,
    };
  }
  if (typeof s.text !== 'string' || s.text.length > LIMITS.resumeChars)
    return { ok: false, reason: 'setup.text' };
  if (typeof s.role !== 'string' || !s.role.trim() || s.role.length > LIMITS.roleChars)
    return { ok: false, reason: 'setup.role' };
  if (typeof s.experienceLevel !== 'string' || !s.experienceLevel.trim() || s.experienceLevel.length > LIMITS.levelChars)
    return { ok: false, reason: 'setup.experienceLevel' };
  if (s.jobDescription !== undefined && (typeof s.jobDescription !== 'string' || s.jobDescription.length > LIMITS.jdChars))
    return { ok: false, reason: 'setup.jobDescription' };
  // Rebuild the object so unknown fields never flow into prompt assembly.
  return {
    ok: true,
    value: {
      text: s.text,
      role: s.role,
      experienceLevel: s.experienceLevel,
      jobDescription: s.jobDescription as string | undefined,
    } satisfies ResumeData,
  };
}

export function validateMessages(
  raw: unknown,
  maxMessages: number = LIMITS.maxTurns * 2
): Validated<InterviewMessage[]> {
  if (!Array.isArray(raw)) return { ok: false, reason: 'messages not an array' };
  if (raw.length > maxMessages) return { ok: false, reason: 'turn_limit' };
  const out: InterviewMessage[] = [];
  for (const m of raw) {
    if (typeof m !== 'object' || m === null) return { ok: false, reason: 'message shape' };
    const { role, content } = m as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return { ok: false, reason: 'message role' };
    if (typeof content !== 'string' || content.length > LIMITS.messageChars)
      return { ok: false, reason: 'message content' };
    out.push({ role, content, timestamp: 0 });
  }
  return { ok: true, value: out };
}
