import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRehearsalServer, PROGRESS_URI, SCORECARD_URI } from './rehearsalServer';
import { MemoryStore, type Scorecard } from './store';
import type { RehearsalLLM } from './llm';
import type { Competency } from './scenarios';

/** Deterministic stand-in for Gemini: echoes turns, scores from a lookup. */
function fakeLLM(scores: Partial<Record<Competency, number>> = {}): RehearsalLLM {
  return {
    choosePersona: () => 'examiner',
    counterpartTurn: async (_setup, _persona, messages) =>
      messages.length === 0 ? 'So, what did you want to talk about?' : `You said: ${messages[messages.length - 1].content}`,
    score: async (_setup, competencies): Promise<Scorecard> => ({
      overallScore: 70,
      headline: 'Clear ask, shaky under pushback.',
      competencyScores: competencies.map(c => ({ competency: c, score: scores[c] ?? 70, evidence: `evidence for ${c}` })),
      strengths: ['Opened with the ask'],
      improvements: ['Hold your number'],
      tryNextTime: 'Based on the scope I own now, I am asking for 12%.',
    }),
  };
}

// Shared across connections so sessions from separate connects never collide in a shared store.
let t = 0;
let id = 0;

async function connect(llm = fakeLLM(), store = new MemoryStore()) {
  const server = createRehearsalServer({ llm, store, userId: 'demo', now: () => ++t, newId: () => `s${++id}` });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test-host', version: '1.0.0' });
  await client.connect(clientSide);
  return { client, store };
}

const structured = (r: Awaited<ReturnType<Client['callTool']>>) => r.structuredContent as Record<string, any>;

describe('RehearseAll MCP server', () => {
  it('advertises the rehearsal tools, with UI metadata on the card tools', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(
      ['finish_rehearsal', 'get_progress', 'list_scenarios', 'say_to_counterpart', 'start_rehearsal'],
    );
    const finish = tools.find(t => t.name === 'finish_rehearsal')!;
    expect((finish._meta as any).ui.resourceUri).toBe(SCORECARD_URI);
    const progress = tools.find(t => t.name === 'get_progress')!;
    expect((progress._meta as any)['ui/resourceUri']).toBe(PROGRESS_URI);
  });

  it('serves the card views as MCP App HTML resources', async () => {
    const { client } = await connect();
    const res = await client.readResource({ uri: SCORECARD_URI });
    const view = res.contents[0] as { mimeType: string; text: string };
    expect(view.mimeType).toBe('text/html;profile=mcp-app');
    expect(view.text).toContain('ui/notifications/tool-result');
  });

  it('runs a preset rehearsal end to end and keeps the session on the server', async () => {
    const { client, store } = await connect();
    const start = structured(await client.callTool({ name: 'start_rehearsal', arguments: { scenario_id: 'ask-for-a-raise' } }));
    expect(start.counterpart_line).toBe('So, what did you want to talk about?');
    expect(start.skills).toContain('Making the ask');

    const turn = structured(await client.callTool({
      name: 'say_to_counterpart',
      arguments: { session_id: start.session_id, user_said: 'I want to talk about my pay.' },
    }));
    expect(turn.counterpart_line).toBe('You said: I want to talk about my pay.');
    expect(turn.exchange).toBe(1);
    expect(store.get(start.session_id)!.messages).toHaveLength(3);

    const card = structured(await client.callTool({ name: 'finish_rehearsal', arguments: { session_id: start.session_id } }));
    expect(card.overallScore).toBe(70);
    expect(card.competencyScores).toHaveLength(4);
    expect(card.sessions_completed).toBe(1);
  });

  it('supports a custom rehearsal from just a counterpart and a goal', async () => {
    const { client } = await connect();
    const start = structured(await client.callTool({
      name: 'start_rehearsal',
      arguments: { counterpart: 'my landlord', goal: 'tell them I am moving out without losing the deposit' },
    }));
    expect(start.title).toBe('Conversation with my landlord');
    expect(start.counterpart).toBe('my landlord');
  });

  it('remembers the weakest skill across sessions and recommends what to practice', async () => {
    const llm = fakeLLM({ 'Handling pushback': 40, Evidence: 85 });
    const store = new MemoryStore();
    for (const scenario of ['ask-for-a-raise', 'negotiate-an-offer']) {
      const { client } = await connect(llm, store);
      const s = structured(await client.callTool({ name: 'start_rehearsal', arguments: { scenario_id: scenario } }));
      await client.callTool({ name: 'say_to_counterpart', arguments: { session_id: s.session_id, user_said: 'Here is my case.' } });
      await client.callTool({ name: 'finish_rehearsal', arguments: { session_id: s.session_id } });
    }
    // A fresh connection: nothing held in the client or server instance, only the store.
    const { client } = await connect(llm, store);
    const progress = structured(await client.callTool({ name: 'get_progress', arguments: {} }));
    expect(progress.sessionsCompleted).toBe(2);
    expect(progress.weakest.competency).toBe('Handling pushback');
    expect(progress.recommended).not.toBeNull();

    const list = structured(await client.callTool({ name: 'list_scenarios', arguments: {} }));
    expect(list.recommended.because).toBe('Handling pushback');
  });

  it('returns tool errors instead of throwing for bad input', async () => {
    const { client } = await connect();
    const unknown = await client.callTool({ name: 'start_rehearsal', arguments: { scenario_id: 'nope' } });
    expect(unknown.isError).toBe(true);
    const missing = await client.callTool({ name: 'start_rehearsal', arguments: {} });
    expect(missing.isError).toBe(true);
    const start = structured(await client.callTool({ name: 'start_rehearsal', arguments: { scenario_id: 'own-a-mistake' } }));
    const empty = await client.callTool({ name: 'finish_rehearsal', arguments: { session_id: start.session_id } });
    expect(empty.isError).toBe(true);
  });
});
