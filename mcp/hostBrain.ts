import { GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai';
import { MODEL_ROUTES } from '../api/_lib/modelRouting';

/**
 * PROXY, NOT ALEXA+. The simulator's "assistant brain": an LLM that plays the role Alexa+
 * plays for a real add-on (decide when to call a tool, then speak the result). Real Alexa+
 * tooling is partner-only, so the hackathon demo path is a web host acting as a real MCP
 * client (see the hackathon FAQ). What this proves: the MCP server works for an LLM host that
 * only sees tools/list. What it cannot prove: how Alexa+'s own routing, voice, or
 * paraphrasing would behave.
 */

export type HostTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  // `opaque` is provider state the browser must hand back unchanged (Gemini thought
  // signatures, OpenRouter reasoning_details): reasoning models reject tool replays without it.
  | { role: 'assistant'; toolCall: { id: string; name: string; args: Record<string, unknown> }; opaque?: unknown }
  | { role: 'tool'; toolCallId: string; name: string; result: unknown };

export interface BrainRequest {
  turns: HostTurn[];
  tools: { name: string; description?: string; inputSchema: unknown }[];
  serverInstructions?: string;
  activeSessionId?: string | null;
}

export type BrainReply =
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown>; opaque?: unknown }
  | { type: 'speak'; text: string };

export type HostBrain = (req: BrainRequest) => Promise<BrainReply>;

const HOST_PROMPT = `You are simulating Alexa+, Amazon's voice assistant, as the host for the RehearseAll add-on.
You talk to the user out loud: answer in one or two short spoken sentences. No markdown, no lists, no emoji.
Use RehearseAll's tools when the user wants to rehearse a conversation, hear the options, get feedback, or see progress.
To start a custom rehearsal you need who it is with and what the user wants; if either is missing, ask one short question.
While a rehearsal is active the user is speaking TO the counterpart, not to you: call say_to_counterpart with their words
exactly as said. Never answer for the counterpart and never coach mid-rehearsal. Leave the rehearsal only if the user
asks to stop, wants feedback ("how did I do"), or clearly changes topic. Wanting feedback means finish_rehearsal.
After finish_rehearsal, read the headline and the line to try next time; the full scorecard is on screen, so do not read
every number. After get_progress, name the weakest skill and the suggested scenario.`;

export function hostSystemPrompt(req: BrainRequest): string {
  return [
    HOST_PROMPT,
    req.serverInstructions ? `\nAdd-on instructions from the RehearseAll server:\n${req.serverInstructions}` : '',
    req.activeSessionId ? `\nA rehearsal is active. session_id: ${req.activeSessionId}` : '\nNo rehearsal is active.',
  ].join('\n');
}

function geminiContents(turns: HostTurn[]): Content[] {
  return turns.map((t): Content => {
    if (t.role === 'user') return { role: 'user', parts: [{ text: t.text }] };
    if (t.role === 'tool') {
      return { role: 'user', parts: [{ functionResponse: { name: t.name, response: { result: t.result } } }] };
    }
    if ('toolCall' in t) {
      const part: Part = { functionCall: { name: t.toolCall.name, args: t.toolCall.args } };
      if (typeof t.opaque === 'string') part.thoughtSignature = t.opaque;
      return { role: 'model', parts: [part] };
    }
    return { role: 'model', parts: [{ text: t.text }] };
  });
}

export function geminiBrain(apiKey: string): HostBrain {
  const ai = new GoogleGenAI({ apiKey });
  return async req => {
    let lastErr: unknown;
    for (const model of MODEL_ROUTES.INTERACTIVE.chain) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: geminiContents(req.turns),
          config: {
            systemInstruction: hostSystemPrompt(req),
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            tools: [{
              functionDeclarations: req.tools.map(t => ({
                name: t.name,
                description: t.description ?? '',
                parametersJsonSchema: t.inputSchema,
              })),
            }],
          },
        });
        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const call = parts.find(p => p.functionCall);
        if (call?.functionCall?.name) {
          return {
            type: 'tool_call',
            id: call.functionCall.id ?? crypto.randomUUID(),
            name: call.functionCall.name,
            args: (call.functionCall.args ?? {}) as Record<string, unknown>,
            opaque: call.thoughtSignature,
          };
        }
        const text = response.text?.trim();
        if (text) return { type: 'speak', text };
        lastErr = new Error(`empty host reply from ${model}`);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };
}
