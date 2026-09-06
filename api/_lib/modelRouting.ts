import { ThinkingLevel, type GenerateContentConfig } from '@google/genai';

interface TextGenerationRoute {
  chain: readonly string[];
  thinkingLevel: ThinkingLevel;
}

interface LiveGenerationRoute {
  model: string;
}

// Route each workload to the least-expensive current model that fits it.
// Keep fallbacks on models that accept the same thinking configuration.
export const MODEL_ROUTES = {
  INTERACTIVE: {
    chain: ['gemini-3.5-flash-lite', 'gemini-3.5-flash'],
    thinkingLevel: ThinkingLevel.MINIMAL,
  },
  ASSESSMENT_DECK: {
    chain: ['gemini-3.5-flash-lite', 'gemini-3.5-flash'],
    thinkingLevel: ThinkingLevel.MINIMAL,
  },
  EVALUATION: {
    chain: ['gemini-3.8-flash', 'gemini-3.5-flash'],
    thinkingLevel: ThinkingLevel.LOW,
  },
  LIVE: {
    model: 'gemini-3.1-flash-live-preview',
  },
} as const satisfies Record<string, TextGenerationRoute | LiveGenerationRoute>;

export function generationConfig(route: TextGenerationRoute): Pick<GenerateContentConfig, 'thinkingConfig'> {
  return {
    thinkingConfig: { thinkingLevel: route.thinkingLevel },
  };
}
