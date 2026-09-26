import { ThinkingLevel, type GenerateContentConfig } from '@google/genai';

interface TextGenerationRoute {
  chain: readonly string[];
  thinkingLevel: ThinkingLevel;
}

// Route each workload to the least-expensive current model that fits it.
// Keep fallbacks on models that accept the same thinking configuration.
export const MODEL_ROUTES = {
  INTERACTIVE: {
    chain: ['gemini-3.8-flash', 'gemini-3.7-flash'],
    thinkingLevel: ThinkingLevel.LOW,
  },
  ASSESSMENT_DECK: {
    chain: ['gemini-3.8-flash', 'gemini-3.7-flash'],
    thinkingLevel: ThinkingLevel.MEDIUM,
  },
  EVALUATION: {
    chain: ['gemini-3.8-flash', 'gemini-3.7-flash'],
    thinkingLevel: ThinkingLevel.MEDIUM,
  },
} as const satisfies Record<string, TextGenerationRoute>;

export function generationConfig(route: TextGenerationRoute): Pick<GenerateContentConfig, 'thinkingConfig'> {
  return {
    thinkingConfig: { thinkingLevel: route.thinkingLevel },
  };
}
