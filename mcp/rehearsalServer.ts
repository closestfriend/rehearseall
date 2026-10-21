import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { RehearsalLLM } from './llm';
import { SCENARIOS, customScenario, getScenario, toConversationSetup, type Scenario } from './scenarios';
import { computeProgress, type RehearsalSession, type RehearsalStore } from './store';

// MCP Apps (io.modelcontextprotocol/ui): tools point at a ui:// resource the host renders.
export const MCP_APP_MIME = 'text/html;profile=mcp-app';
export const SCORECARD_URI = 'ui://rehearseall/scorecard.html';
export const PROGRESS_URI = 'ui://rehearseall/progress.html';

const SUGGEST_FINISH_AFTER = 6;

const SERVER_INSTRUCTIONS = `RehearseAll lets someone rehearse a hard conversation out loud before having it for real.
Flow: start_rehearsal -> say_to_counterpart (repeat) -> finish_rehearsal. get_progress reports skills across sessions.
While a rehearsal is running, the user is talking TO the counterpart: pass their words to say_to_counterpart unchanged,
and speak counterpart_line verbatim, in character. Only break the flow if the user asks to stop, wants feedback, or changes topic.`;

function uiMeta(uri: string) {
  // `ui.resourceUri` is current; the flat key keeps older MCP Apps hosts working.
  return { ui: { resourceUri: uri }, 'ui/resourceUri': uri };
}

function view(name: string): string {
  return readFileSync(new URL(`./views/${name}`, import.meta.url), 'utf8');
}

function ok(text: string, structuredContent: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text }], structuredContent };
}

function fail(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function setupFor(session: RehearsalSession) {
  return toConversationSetup(session, undefined, session.concern);
}

export interface RehearsalServerDeps {
  llm: RehearsalLLM;
  store: RehearsalStore;
  userId: string;
  now?: () => number;
  newId?: () => string;
}

export function createRehearsalServer({ llm, store, userId, now = Date.now, newId = randomUUID }: RehearsalServerDeps): McpServer {
  const server = new McpServer(
    { name: 'rehearseall', title: 'RehearseAll', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  const progress = () => computeProgress(store.finishedFor(userId));

  server.registerTool(
    'list_scenarios',
    {
      title: 'List rehearsal scenarios',
      description:
        'Lists the hard conversations RehearseAll can rehearse, and which one to practice next based on the user\'s weakest skill. ' +
        'Any other conversation can be rehearsed too: call start_rehearsal with a counterpart and a goal.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const p = progress();
      const recommended = p.recommendedScenarioId ? getScenario(p.recommendedScenarioId) : undefined;
      const lines = SCENARIOS.map(s => `- ${s.title} (${s.id})`).join('\n');
      const suggestion = recommended && p.weakest
        ? `\nYour weakest skill so far is ${p.weakest.competency}. Suggested next: ${recommended.title}.`
        : '';
      return ok(`Scenarios:\n${lines}\nOr rehearse any conversation by describing who it is with and what you want.${suggestion}`, {
        scenarios: SCENARIOS.map(({ id, title, counterpart, goal, competencies }) => ({ id, title, counterpart, goal, competencies })),
        recommended: recommended ? { id: recommended.id, title: recommended.title, because: p.weakest?.competency } : null,
      });
    },
  );

  server.registerTool(
    'start_rehearsal',
    {
      title: 'Start a rehearsal',
      description:
        'Starts rehearsing a conversation and returns the counterpart\'s opening line. Prefer a preset scenario_id when one fits: ' +
        `${SCENARIOS.map(s => `${s.id} (${s.title})`).join('; ')}. ` +
        'Otherwise pass counterpart + goal for anything else ("my landlord", "tell them I\'m moving out"). ' +
        'Speak counterpart_line verbatim, then send the user\'s reply to say_to_counterpart with the returned session_id.',
      inputSchema: {
        scenario_id: z.string().optional().describe('A preset id from list_scenarios'),
        counterpart: z.string().optional().describe('Who the user will be talking to, for a custom rehearsal'),
        goal: z.string().optional().describe('What the user wants out of the conversation, for a custom rehearsal'),
        details: z.string().optional().describe('Specifics that make it real: names, numbers, history'),
        worry: z.string().optional().describe('What the user is afraid will happen. Kept private from the counterpart.'),
      },
    },
    async ({ scenario_id, counterpart, goal, details, worry }) => {
      let scenario: Scenario | undefined;
      if (scenario_id) {
        scenario = getScenario(scenario_id);
        if (!scenario) return fail(`Unknown scenario "${scenario_id}". Call list_scenarios for valid ids.`);
      } else if (counterpart?.trim() && goal?.trim()) {
        scenario = customScenario({ counterpart, goal });
      } else {
        return fail('Give either a scenario_id, or both a counterpart and a goal.');
      }

      const setup = toConversationSetup(scenario, details, worry);
      const session: RehearsalSession = {
        id: newId(),
        userId,
        scenarioId: scenario.id,
        title: setup.title,
        counterpart: setup.counterpart,
        goal: setup.goal,
        context: setup.context,
        concern: setup.concern,
        competencies: scenario.competencies,
        personaId: llm.choosePersona(),
        messages: [],
        startedAt: now(),
      };
      const opener = await llm.counterpartTurn(setup, session.personaId, []);
      session.messages.push({ role: 'assistant', content: opener, timestamp: now() });
      store.save(session);

      return ok(`Rehearsal started: ${session.title}. Your goal: ${session.goal}. They open with: "${opener}"`, {
        session_id: session.id,
        title: session.title,
        counterpart: session.counterpart,
        your_goal: session.goal,
        skills: session.competencies,
        counterpart_line: opener,
        exchange: 0,
      });
    },
  );

  server.registerTool(
    'say_to_counterpart',
    {
      title: 'Say something to the counterpart',
      description:
        'Sends what the user just said, unchanged, to the counterpart in a running rehearsal and returns their reply. ' +
        'Speak counterpart_line verbatim and in character. When suggest_finish is true, offer to wrap up with finish_rehearsal.',
      inputSchema: {
        session_id: z.string().describe('From start_rehearsal'),
        user_said: z.string().min(1).describe('The user\'s words, exactly as spoken'),
      },
    },
    async ({ session_id, user_said }) => {
      const session = store.get(session_id);
      if (!session || session.userId !== userId) return fail('No rehearsal with that session_id. Start one with start_rehearsal.');
      if (session.finishedAt) return fail('That rehearsal is already finished. Start a new one, or call get_progress.');

      session.messages.push({ role: 'user', content: user_said, timestamp: now() });
      const reply = await llm.counterpartTurn(setupFor(session), session.personaId, session.messages);
      session.messages.push({ role: 'assistant', content: reply, timestamp: now() });
      store.save(session);

      const exchange = session.messages.filter(m => m.role === 'user').length;
      const suggestFinish = exchange >= SUGGEST_FINISH_AFTER;
      return ok(reply, {
        session_id: session.id,
        counterpart_line: reply,
        exchange,
        suggest_finish: suggestFinish,
      });
    },
  );

  server.registerTool(
    'finish_rehearsal',
    {
      title: 'Finish and score a rehearsal',
      description:
        'Ends a rehearsal and scores it on the skills it trains, with evidence from what the user said, and compares it with past sessions. ' +
        'Read the headline aloud; the scorecard is shown on screen.',
      inputSchema: { session_id: z.string().describe('From start_rehearsal') },
      _meta: uiMeta(SCORECARD_URI),
    },
    async ({ session_id }) => {
      const session = store.get(session_id);
      if (!session || session.userId !== userId) return fail('No rehearsal with that session_id.');
      if (session.scorecard) return fail('That rehearsal was already scored. Call get_progress to see it.');
      if (!session.messages.some(m => m.role === 'user')) {
        return fail('Nothing to score yet: the user has not said anything in this rehearsal.');
      }

      const before = progress();
      const scorecard = await llm.score(setupFor(session), session.competencies, session.messages);
      session.scorecard = scorecard;
      session.finishedAt = now();
      store.save(session);

      const previous = Object.fromEntries(before.competencies.map(c => [c.competency, c.average]));
      const sorted = [...scorecard.competencyScores].sort((a, b) => a.score - b.score);
      const workOn = sorted[0];
      const best = sorted[sorted.length - 1];

      const text = [
        `${scorecard.headline} Overall ${Math.round(scorecard.overallScore)} out of 100.`,
        best ? `Strongest: ${best.competency}.` : '',
        workOn ? `Work on: ${workOn.competency}.` : '',
        `Next time, try saying: "${scorecard.tryNextTime}"`,
      ].filter(Boolean).join(' ');

      return ok(text, {
        session_id: session.id,
        title: session.title,
        counterpart: session.counterpart,
        exchanges: session.messages.filter(m => m.role === 'user').length,
        ...scorecard,
        previous_averages: previous,
        sessions_completed: before.sessionsCompleted + 1,
      });
    },
  );

  server.registerTool(
    'get_progress',
    {
      title: 'Show rehearsal progress',
      description:
        'Shows how the user\'s skills are trending across every rehearsal they have finished, their weakest skill, ' +
        'and which scenario to practice next.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
      _meta: uiMeta(PROGRESS_URI),
    },
    async () => {
      const p = progress();
      if (p.sessionsCompleted === 0) {
        return ok('No finished rehearsals yet. Try one, then I can track your progress.', { ...p, recommended: null });
      }
      const recommended = p.recommendedScenarioId ? getScenario(p.recommendedScenarioId) : undefined;
      const text = [
        `${p.sessionsCompleted} rehearsal${p.sessionsCompleted === 1 ? '' : 's'} so far.`,
        p.weakest ? `Weakest skill: ${p.weakest.competency}, averaging ${p.weakest.average}.` : '',
        p.strongest ? `Strongest: ${p.strongest.competency} at ${p.strongest.average}.` : '',
        recommended ? `To work on ${p.weakest?.competency}, try: ${recommended.title}.` : '',
      ].filter(Boolean).join(' ');
      return ok(text, {
        ...p,
        recommended: recommended ? { id: recommended.id, title: recommended.title } : null,
      });
    },
  );

  for (const [name, uri, file] of [
    ['Rehearsal scorecard', SCORECARD_URI, 'scorecard.html'],
    ['Rehearsal progress', PROGRESS_URI, 'progress.html'],
  ] as const) {
    server.registerResource(name, uri, { mimeType: MCP_APP_MIME, description: `${name} card (MCP App view)` }, async u => ({
      contents: [{ uri: u.href, mimeType: MCP_APP_MIME, text: view(file) }],
    }));
  }

  return server;
}
