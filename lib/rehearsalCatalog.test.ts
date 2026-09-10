import { describe, expect, it } from 'vitest';
import {
  HUNTER_REHEARSALS,
  REHEARSAL_PRESETS,
  createRehearsalSetup,
  findRehearsalPresets,
  formatRehearsalListedSize,
  getRehearsalPreset,
  resolveRehearsalSelection,
} from './rehearsalCatalog';

const EXPECTED_TITLES = [
  'Hobbyist Interview',
  'OCR Video Captioning',
  'Office.js Proficiency Test',
  'Personal Introduction',
  'Quant Screen',
  'Situational Interview',
  'Software Mastery Interview',
  'System Design Session',
  'Visual Design Showcase',
  'Visual Media Assessment',
  'Voice Acting Interview',
  'Domain Expert Interview',
  'Math Contest',
  'Olympiad Problem',
  'Reasoning Style Assessment',
  'Writing Interview',
  'Bilingual Competency',
  'Law Interview',
  'Code Review Session',
  'Finance Interview',
  'Software Engineering Demo',
  'Clinical Case Study',
  'Algorithms Interview',
  'Audio Media Assessment',
  'Brainstorming Session',
  'Consulting Interview',
  'Creative Prompt Writing',
  'Data Science Interview',
  'General Assessment',
  'Cybersecurity Interview',
  'AI Fluency Interview',
  'AI Proficiency Interview',
  'Brief Introduction',
  'Data Annotation Test',
  'Frontier AI: Pattern & Puzzle Eval',
  'Technical Screen',
  'Model Response Evaluation',
  'Niche Programming Session',
  'Robotics Engineering',
  'Sports Expert Interview',
  'STEM Skills Challenge',
  'Task Review Exercise',
  'TESt',
] as const;

describe('custom rehearsal catalog', () => {
  it('offers the five Hunter-only conversation preloads requested for today', () => {
    expect(HUNTER_REHEARSALS.map(preset => preset.setup.title)).toEqual([
      'Contact A — presentation pre-read, warm',
      'Contact B — 12 minutes, distracted',
      'Contact C — supervisor joins, rigor check',
      'Contact D — collaboration offer, pacing risk',
      'Strategy 2027 — artist strategy call',
    ]);
    expect(new Set(HUNTER_REHEARSALS.map(preset => preset.id)).size).toBe(5);
    expect(HUNTER_REHEARSALS.every(preset => preset.setup.kind === 'conversation')).toBe(true);

    const karman = HUNTER_REHEARSALS.find(preset => preset.id === 'strategy-2027');
    expect(karman?.setup.context.match(/^\d+\./gm)).toHaveLength(15);
  });

  it('contains every screenshot title exactly once with the expected format totals', () => {
    expect(REHEARSAL_PRESETS).toHaveLength(43);
    expect(new Set(REHEARSAL_PRESETS.map(preset => preset.title)).size).toBe(43);
    expect(REHEARSAL_PRESETS.map(preset => preset.title).sort()).toEqual([...EXPECTED_TITLES].sort());
    expect(REHEARSAL_PRESETS.filter(preset => preset.format === 'interview')).toHaveLength(30);
    expect(REHEARSAL_PRESETS.filter(preset => preset.format === 'assessment')).toHaveLength(13);
  });

  it('searches titles, domains, and competencies without case sensitivity', () => {
    expect(findRehearsalPresets('OFFICE.JS').map(preset => preset.title)).toEqual(['Office.js Proficiency Test']);
    expect(findRehearsalPresets('cybersecurity').map(preset => preset.title)).toContain('Cybersecurity Interview');
    expect(findRehearsalPresets('threat modeling').map(preset => preset.title)).toEqual(['Cybersecurity Interview']);
  });

  it('combines format and domain filters', () => {
    const results = findRehearsalPresets('', 'assessment', 'AI and evaluation');
    expect(results.map(preset => preset.title)).toEqual(['Model Response Evaluation']);
  });

  it('creates a bounded run setup from a preset and trims participant context', () => {
    const preset = getRehearsalPreset('software-engineering-demo');
    expect(preset).toBeDefined();
    const setup = createRehearsalSetup(preset!, '  I want to demo a TypeScript project.  ');
    expect(setup).toMatchObject({
      kind: 'rehearsal',
      presetId: 'software-engineering-demo',
      title: 'Software Engineering Demo',
      format: 'interview',
      participantContext: 'I want to demo a TypeScript project.',
      supportsScreenShare: true,
    });
    expect(setup.targetQuestionCount).toBe(preset!.practiceQuestionCount);
  });

  it('uses singular copy for a one-question listing', () => {
    const preset = getRehearsalPreset('test');
    expect(formatRehearsalListedSize(preset!)).toBe('1 question listed');
  });

  it('moves selection to the first visible result when filters hide the prior selection', () => {
    const results = findRehearsalPresets('model response');
    expect(resolveRehearsalSelection(results, 'hobbyist-interview')?.id).toBe('model-response-evaluation');
  });
});
