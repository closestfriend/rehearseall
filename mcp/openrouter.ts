import type { ConversationSetup, InterviewMessage } from '../types';
import { buildPracticeKickoff, buildPracticeSystemInstruction, getPersona, pickPersona } from '../api/_lib/prompts';
import { buildEvaluatorPrompt } from '../api/_lib/evaluatorPrompt';
import { formatTranscriptForEvaluator } from '../api/_lib/transcriptFormat';
import { MODEL_ROUTES } from '../api/_lib/modelRouting';
import { SCORECARD_JSON_SCHEMA, keepScenarioSkills, scorecardInstruction, type RehearsalLLM } from './llm';
import { hostSystemPrompt, type BrainReply, type HostBrain, type HostTurn } from './hostBrain';
import type { Competency } from './scenarios';
import type { Scorecard } from './store';

// The same Gemini models the app routes to directly, reached through OpenRouter's
// OpenAI-compatible API instead of the Gemini API.
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const viaOpenRouter = (chain: readonly string[]) => chain.map(m => `google/${m}`);

type Effort = 'minimal' | 'low' | 'medium';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  reasoning_details?: unknown;
}

async function complete(apiKey: string, models: string[], body: Record<string, unknown>, effort: Effort) {
  let lastErr: unknown;
  for (const model of models) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'X-Title': 'RehearseAll' },
        body: JSON.stringify({ model, reasoning: { effort }, ...body }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = await res.json() as any;
      if (!res.ok || data.error) throw new Error(`OpenRouter ${model}: ${res.status} ${JSON.stringify(data.error ?? data).slice(0, 300)}`);
      const message = data.choices?.[0]?.message;
      if (!message) throw new Error(`OpenRouter ${model}: no message`);
      return message as ChatMessage;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export class OpenRouterRehearsalLLM implements RehearsalLLM {
  constructor(private readonly apiKey: string) {}

  choosePersona(): string {
    return pickPersona().id;
  }

  async counterpartTurn(setup: ConversationSetup, personaId: string, messages: InterviewMessage[]): Promise<string> {
    const persona = getPersona(personaId) ?? pickPersona();
    const chat: ChatMessage[] = [
      { role: 'system', content: buildPracticeSystemInstruction(setup, persona) },
      { role: 'user', content: buildPracticeKickoff(setup) },
      ...messages.map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content })),
    ];
    const reply = await complete(this.apiKey, viaOpenRouter(MODEL_ROUTES.INTERACTIVE.chain), { messages: chat }, 'low');
    const text = reply.content?.trim();
    if (!text) throw new Error('empty counterpart turn');
    return text;
  }

  async score(setup: ConversationSetup, competencies: Competency[], messages: InterviewMessage[]): Promise<Scorecard> {
    const reply = await complete(this.apiKey, viaOpenRouter(MODEL_ROUTES.EVALUATION.chain), {
      messages: [
        { role: 'system', content: scorecardInstruction(competencies) },
        { role: 'user', content: buildEvaluatorPrompt(setup, formatTranscriptForEvaluator(messages)) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'scorecard', strict: true, schema: SCORECARD_JSON_SCHEMA } },
    }, 'medium');
    if (!reply.content) throw new Error('empty scorecard');
    return keepScenarioSkills(JSON.parse(reply.content) as Scorecard, competencies);
  }
}

function chatMessages(turns: HostTurn[]): ChatMessage[] {
  return turns.map((t): ChatMessage => {
    if (t.role === 'user') return { role: 'user', content: t.text };
    if (t.role === 'tool') return { role: 'tool', tool_call_id: t.toolCallId, content: JSON.stringify(t.result) };
    if ('toolCall' in t) {
      return {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: t.toolCall.id, type: 'function', function: { name: t.toolCall.name, arguments: JSON.stringify(t.toolCall.args) } }],
        // Gemini 3 via OpenRouter needs its reasoning_details replayed with the tool call.
        ...(t.opaque ? { reasoning_details: t.opaque } : {}),
      };
    }
    return { role: 'assistant', content: t.text };
  });
}

export function openRouterBrain(apiKey: string): HostBrain {
  return async (req): Promise<BrainReply> => {
    const reply = await complete(apiKey, viaOpenRouter(MODEL_ROUTES.INTERACTIVE.chain), {
      messages: [{ role: 'system', content: hostSystemPrompt(req) }, ...chatMessages(req.turns)],
      tools: req.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description ?? '', parameters: t.inputSchema },
      })),
    }, 'minimal');
    const call = reply.tool_calls?.[0];
    if (call) {
      let args: Record<string, unknown> = {};
      try { args = call.function.arguments ? JSON.parse(call.function.arguments) : {}; } catch { /* model sent bad JSON: call with none */ }
      return { type: 'tool_call', id: call.id, name: call.function.name, args, opaque: reply.reasoning_details };
    }
    const text = reply.content?.trim();
    if (!text) throw new Error('empty host reply');
    return { type: 'speak', text };
  };
}
