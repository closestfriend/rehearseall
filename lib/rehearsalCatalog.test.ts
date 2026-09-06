import { describe, expect, it } from 'vitest';
import {
  REHEARSAL_PRESETS,
  createRehearsalSetup,
  findRehearsalPresets,
  getRehearsalPreset,
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
});
