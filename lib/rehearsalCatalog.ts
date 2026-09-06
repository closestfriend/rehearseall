import type { RehearsalFormat, RehearsalPreset, RehearsalSetup } from '../types';

type PresetInput = Omit<
  RehearsalPreset,
  'collection' | 'sourceConfidence' | 'supportsScreenShare'
> & { supportsScreenShare?: boolean };

const makePreset = (input: PresetInput): RehearsalPreset => ({
  ...input,
  collection: 'practice',
  sourceConfidence: 'title-only',
  supportsScreenShare: input.supportsScreenShare ?? false,
});

export const REHEARSAL_PRESETS: RehearsalPreset[] = [
  makePreset({
    id: 'hobbyist-interview', title: 'Hobbyist Interview', domain: 'General and communication', format: 'interview', listedDurationMinutes: 13, practiceQuestionCount: 4,
    description: 'Explain a serious personal pursuit with the depth of someone who practices it regularly.',
    instructions: 'Begin with the hobby, then probe technique, progression, judgment, and what sustained practice has taught the candidate.',
    competencies: ['domain vocabulary', 'reflective practice', 'specific examples'],
    guidance: ['ask how the practice changed over time', 'test one concrete technical claim', 'separate enthusiasm from demonstrated depth'],
    evaluationCriteria: ['specificity', 'credible depth', 'clear explanation to a non-specialist'],
  }),
  makePreset({
    id: 'personal-introduction', title: 'Personal Introduction', domain: 'General and communication', format: 'interview', listedDurationMinutes: 9, practiceQuestionCount: 4,
    description: 'Give a compact account of your background, strongest evidence, and current direction.',
    instructions: 'Invite an introduction, then clarify transitions, strongest work, motivations, and fit for the opportunity.',
    competencies: ['narrative clarity', 'evidence selection', 'professional self-knowledge'],
    guidance: ['press for a concrete example', 'ask why the current direction follows from prior work', 'test whether claims are proportionate'],
    evaluationCriteria: ['coherence', 'concision', 'evidence-backed positioning'],
  }),
  makePreset({
    id: 'situational-interview', title: 'Situational Interview', domain: 'General and communication', format: 'interview', listedDurationMinutes: 18, practiceQuestionCount: 5,
    description: 'Work through ambiguous workplace scenarios and explain the judgment behind each response.',
    instructions: 'Present realistic situations involving ambiguity, disagreement, priorities, ownership, and recovery after a mistake.',
    competencies: ['judgment', 'conflict navigation', 'ownership'],
    guidance: ['change one constraint after the first answer', 'ask what the candidate would communicate and when', 'probe downside risk'],
    evaluationCriteria: ['quality of tradeoffs', 'stakeholder awareness', 'actionable decisions'],
  }),
  makePreset({
    id: 'domain-expert-interview', title: 'Domain Expert Interview', domain: 'General and communication', format: 'interview', listedDurationMinutes: 14, practiceQuestionCount: 5,
    description: 'Demonstrate genuine subject-matter depth under increasingly specific follow-up questions.',
    instructions: 'Let the candidate name their domain, identify a demanding real problem, and defend methods, evidence, and boundary conditions.',
    competencies: ['domain depth', 'epistemic calibration', 'technical communication'],
    guidance: ['follow the most specific claim', 'ask how they know', 'probe an edge case or counterexample'],
    evaluationCriteria: ['accuracy', 'depth under follow-up', 'honest boundaries'],
  }),
  makePreset({
    id: 'brief-introduction', title: 'Brief Introduction', domain: 'General and communication', format: 'interview', listedDurationMinutes: 4, practiceQuestionCount: 3,
    description: 'Deliver a credible introduction when there is almost no time for setup.',
    instructions: 'Request a short introduction and use only two compact follow-ups on relevance and strongest evidence.',
    competencies: ['concision', 'prioritization', 'credibility'],
    guidance: ['keep the pace brisk', 'ask for one proof point', 'close with the candidate’s current focus'],
    evaluationCriteria: ['clarity in limited time', 'signal density', 'memorable relevance'],
  }),
  makePreset({
    id: 'brainstorming-session', title: 'Brainstorming Session', domain: 'General and communication', format: 'interview', listedDurationMinutes: 16, practiceQuestionCount: 5,
    description: 'Generate possibilities, choose among them, and develop one idea under changing constraints.',
    instructions: 'Give a bounded problem, invite divergent ideas, then require prioritization and development of one direction.',
    competencies: ['idea fluency', 'selection judgment', 'collaborative iteration'],
    guidance: ['add a constraint', 'ask why one idea beats another', 'look for building on feedback'],
    evaluationCriteria: ['range', 'originality with relevance', 'ability to converge'],
  }),
  makePreset({
    id: 'general-assessment', title: 'General Assessment', domain: 'General and communication', format: 'assessment', listedQuestionCount: 12, practiceQuestionCount: 8,
    description: 'A mixed practice deck spanning comprehension, reasoning, and clear written response.',
    instructions: 'Create a balanced set of practical verbal, numerical, and judgment questions without relying on trivia.',
    competencies: ['reading comprehension', 'basic reasoning', 'written clarity'],
    guidance: ['mix item types', 'make each question self-contained', 'include plausible distractors'],
    evaluationCriteria: ['correctness', 'reasoning quality', 'instruction following'],
  }),
  makePreset({
    id: 'task-review-exercise', title: 'Task Review Exercise', domain: 'General and communication', format: 'interview', listedDurationMinutes: 19, practiceQuestionCount: 5,
    description: 'Review a work product, identify what matters most, and propose actionable changes.',
    instructions: 'Provide a compact simulated task result and ask the candidate to diagnose, prioritize, and communicate revisions.',
    competencies: ['critical review', 'prioritization', 'feedback quality'],
    guidance: ['ask what they would leave unchanged', 'probe the highest-risk issue', 'request a concrete revision'],
    evaluationCriteria: ['signal detection', 'prioritization', 'actionability'],
  }),
  makePreset({
    id: 'test', title: 'TESt', domain: 'General and communication', format: 'assessment', listedQuestionCount: 1, practiceQuestionCount: 1,
    description: 'An unclassified one-item dry run for checking the assessment flow.',
    instructions: 'Create one straightforward, self-contained reasoning question with a verifiable answer.',
    competencies: ['instruction following'], guidance: ['use one short-text item'], evaluationCriteria: ['correctness', 'clarity'],
  }),

  makePreset({
    id: 'office-js-proficiency-test', title: 'Office.js Proficiency Test', domain: 'Software and systems', format: 'assessment', listedQuestionCount: 2, practiceQuestionCount: 2,
    description: 'Solve practical Microsoft Office add-in and automation questions.',
    instructions: 'Use realistic Office.js API scenarios involving async context, document objects, and host differences.',
    competencies: ['Office.js APIs', 'asynchronous programming', 'host compatibility'],
    guidance: ['prefer applied snippets over trivia', 'include one debugging scenario'],
    evaluationCriteria: ['API correctness', 'async reasoning', 'practical robustness'],
  }),
  makePreset({
    id: 'quant-screen', title: 'Quant Screen', domain: 'Software and systems', format: 'interview', listedDurationMinutes: 48, practiceQuestionCount: 8,
    description: 'Reason through quantitative problems aloud while making assumptions and checks explicit.',
    instructions: 'Move from estimation and probability into a multi-step quantitative scenario calibrated to the candidate context.',
    competencies: ['quantitative reasoning', 'probability', 'sanity checking'],
    guidance: ['require assumptions before calculation', 'change one parameter', 'ask for an independent check'],
    evaluationCriteria: ['mathematical correctness', 'transparent reasoning', 'error detection'],
  }),
  makePreset({
    id: 'software-mastery-interview', title: 'Software Mastery Interview', domain: 'Software and systems', format: 'interview', listedDurationMinutes: 41, practiceQuestionCount: 8,
    description: 'Demonstrate deep command of a chosen language, framework, or engineering tool.',
    instructions: 'Ask the candidate to choose a software specialty, then probe internals, debugging, tradeoffs, and production use.',
    competencies: ['software depth', 'debugging', 'production judgment'],
    guidance: ['ask what happens under the abstraction', 'probe a failure they diagnosed', 'compare an alternative'],
    evaluationCriteria: ['technical accuracy', 'depth', 'operational judgment'],
  }),
  makePreset({
    id: 'system-design-session', title: 'System Design Session', domain: 'Software and systems', format: 'interview', listedDurationMinutes: 35, practiceQuestionCount: 7, supportsScreenShare: true,
    description: 'Design a system from requirements through architecture, scaling, and failure handling.',
    instructions: 'Present one system-design problem and progress through requirements, components, data, scale, reliability, and tradeoffs.',
    competencies: ['requirements discovery', 'architecture', 'reliability'],
    guidance: ['invite a shared diagram', 'add a scale constraint', 'probe one failure mode deeply'],
    evaluationCriteria: ['architecture coherence', 'tradeoff quality', 'failure awareness'],
  }),
  makePreset({
    id: 'code-review-session', title: 'Code Review Session', domain: 'Software and systems', format: 'interview', listedDurationMinutes: 25, practiceQuestionCount: 6, supportsScreenShare: true,
    description: 'Review code for correctness, maintainability, security, and communication quality.',
    instructions: 'Ask the candidate to walk through code they share or a simulated snippet, identify risks, and frame constructive review comments.',
    competencies: ['code correctness', 'maintainability', 'review communication'],
    guidance: ['separate blocking from optional feedback', 'probe a hidden edge case', 'ask for a revised approach'],
    evaluationCriteria: ['issue detection', 'severity calibration', 'actionable explanation'],
  }),
  makePreset({
    id: 'software-engineering-demo', title: 'Software Engineering Demo', domain: 'Software and systems', format: 'interview', listedDurationMinutes: 107, practiceQuestionCount: 10, supportsScreenShare: true,
    description: 'Lead a screen-shared project walkthrough and defend implementation and architecture choices.',
    instructions: 'Let the candidate choose a project, narrate the user problem and architecture, demonstrate a key path, and answer deep implementation questions.',
    competencies: ['technical demonstration', 'architecture', 'implementation depth'],
    guidance: ['ask to show evidence on screen', 'probe one consequential tradeoff', 'ask how the system fails and is tested'],
    evaluationCriteria: ['demo coherence', 'technical ownership', 'evidence quality'],
  }),
  makePreset({
    id: 'algorithms-interview', title: 'Algorithms Interview', domain: 'Software and systems', format: 'interview', listedDurationMinutes: 27, practiceQuestionCount: 6,
    description: 'Decompose an algorithmic problem, justify a solution, and analyze its limits.',
    instructions: 'Present one progressively constrained problem and require clarification, approach, correctness argument, complexity, and edge cases.',
    competencies: ['algorithm design', 'complexity analysis', 'edge-case reasoning'],
    guidance: ['do not reveal the solution early', 'ask for a simpler baseline first', 'change one constraint'],
    evaluationCriteria: ['correctness', 'complexity awareness', 'reasoning clarity'],
  }),
  makePreset({
    id: 'cybersecurity-interview', title: 'Cybersecurity Interview', domain: 'Software and systems', format: 'interview', listedDurationMinutes: 36, practiceQuestionCount: 7,
    description: 'Reason from assets and adversaries through controls, detection, and incident response.',
    instructions: 'Use threat-modeling and incident scenarios calibrated to the candidate’s stated security experience.',
    competencies: ['threat modeling', 'security controls', 'incident response'],
    guidance: ['ask for assets and trust boundaries', 'probe detection as well as prevention', 'introduce an active incident'],
    evaluationCriteria: ['risk prioritization', 'control fit', 'incident judgment'],
  }),
  makePreset({
    id: 'technical-screen', title: 'Technical Screen', domain: 'Software and systems', format: 'interview', listedDurationMinutes: 18, practiceQuestionCount: 5,
    description: 'A concise, adaptive screen across prior technical work and one reasoning problem.',
    instructions: 'Begin with the candidate’s strongest project, verify ownership, then test one relevant technical concept and one applied scenario.',
    competencies: ['technical ownership', 'problem solving', 'concise explanation'],
    guidance: ['follow details in the prior answer', 'distinguish team output from individual work', 'request a tradeoff'],
    evaluationCriteria: ['credible ownership', 'technical accuracy', 'reasoning under follow-up'],
  }),
  makePreset({
    id: 'niche-programming-session', title: 'Niche Programming Session', domain: 'Software and systems', format: 'interview', listedDurationMinutes: 23, practiceQuestionCount: 6, supportsScreenShare: true,
    description: 'Show fluency in a specialized language, framework, runtime, or programming domain.',
    instructions: 'Let the candidate name the niche, then test idioms, tooling, internals, debugging, and when not to use it.',
    competencies: ['specialized programming', 'tooling', 'technical judgment'],
    guidance: ['ask for an idiomatic example', 'probe a non-obvious failure', 'compare with a mainstream alternative'],
    evaluationCriteria: ['specialist accuracy', 'practical depth', 'tradeoff judgment'],
  }),
  makePreset({
    id: 'robotics-engineering', title: 'Robotics Engineering', domain: 'Software and systems', format: 'assessment', listedQuestionCount: 5, practiceQuestionCount: 5,
    description: 'Apply robotics fundamentals across sensing, control, planning, integration, and safety.',
    instructions: 'Create applied engineering scenarios with enough quantitative or system detail to reason from.',
    competencies: ['sensing', 'controls', 'systems integration'],
    guidance: ['include one safety case', 'include one debugging item', 'avoid trivia-only prompts'],
    evaluationCriteria: ['technical correctness', 'system reasoning', 'safety awareness'],
  }),

  makePreset({
    id: 'math-contest', title: 'Math Contest', domain: 'Data, math, and reasoning', format: 'interview', listedDurationMinutes: 28, practiceQuestionCount: 6,
    description: 'Solve contest-style mathematics while making the path to the result inspectable.',
    instructions: 'Give one accessible warm-up and one deeper problem; ask for definitions, strategy, derivation, and checks.',
    competencies: ['mathematical reasoning', 'problem decomposition', 'proof communication'],
    guidance: ['offer no hint until a genuine impasse', 'ask why a step is valid', 'request an alternate check'],
    evaluationCriteria: ['correctness', 'rigor', 'clarity of derivation'],
  }),
  makePreset({
    id: 'olympiad-problem', title: 'Olympiad Problem', domain: 'Data, math, and reasoning', format: 'interview', listedDurationMinutes: 27, practiceQuestionCount: 6,
    description: 'Develop and defend a rigorous solution to a proof-oriented olympiad problem.',
    instructions: 'Use one non-routine proof problem and focus the conversation on lemmas, invariants, counterexamples, and completeness.',
    competencies: ['proof strategy', 'rigor', 'creative mathematical insight'],
    guidance: ['challenge an unsupported step', 'ask for a counterexample to a tempting false claim', 'check completeness'],
    evaluationCriteria: ['valid proof', 'strategic insight', 'precision'],
  }),
  makePreset({
    id: 'reasoning-style-assessment', title: 'Reasoning Style Assessment', domain: 'Data, math, and reasoning', format: 'assessment', listedQuestionCount: 22, practiceQuestionCount: 8,
    description: 'Practice analytical, verbal, and decision reasoning across varied item structures.',
    instructions: 'Generate a balanced practice cut that rewards explicit constraints and defensible inference.',
    competencies: ['analytical reasoning', 'verbal logic', 'decision quality'],
    guidance: ['mix single-choice and written items', 'use plausible distractors', 'include ambiguity that must be acknowledged'],
    evaluationCriteria: ['logical validity', 'constraint tracking', 'calibration'],
  }),
  makePreset({
    id: 'data-science-interview', title: 'Data Science Interview', domain: 'Data, math, and reasoning', format: 'interview', listedDurationMinutes: 30, practiceQuestionCount: 7, supportsScreenShare: true,
    description: 'Frame a data problem from decision and measurement through modeling and evaluation.',
    instructions: 'Use a realistic product or research scenario; require target definition, data audit, baseline, model choice, evaluation, and monitoring.',
    competencies: ['problem framing', 'data quality', 'model evaluation'],
    guidance: ['probe leakage and bias', 'ask for a baseline', 'change the cost of one error type'],
    evaluationCriteria: ['framing quality', 'method fit', 'evaluation rigor'],
  }),
  makePreset({
    id: 'data-annotation-test', title: 'Data Annotation Test', domain: 'Data, math, and reasoning', format: 'assessment', listedQuestionCount: 25, practiceQuestionCount: 8,
    description: 'Apply labeling guidelines consistently across clear cases, edge cases, and conflicts.',
    instructions: 'Define a compact annotation rubric, then create items that test literal application and principled escalation.',
    competencies: ['guideline application', 'consistency', 'edge-case judgment'],
    guidance: ['repeat a subtle distinction across items', 'include insufficient-information cases', 'avoid hidden assumptions'],
    evaluationCriteria: ['label accuracy', 'consistency', 'appropriate escalation'],
  }),
  makePreset({
    id: 'frontier-ai-pattern-puzzle-eval', title: 'Frontier AI: Pattern & Puzzle Eval', domain: 'Data, math, and reasoning', format: 'assessment', practiceQuestionCount: 8,
    description: 'Infer patterns and constraints from compact symbolic and verbal puzzles.',
    instructions: 'Create original pattern, sequence, spatial-description, and constraint-satisfaction items that can be solved from text alone.',
    competencies: ['pattern induction', 'constraint reasoning', 'working memory'],
    guidance: ['do not reuse famous puzzle wording', 'ensure one defensible answer', 'vary surface form'],
    evaluationCriteria: ['correct inference', 'constraint coverage', 'explanation quality'],
  }),
  makePreset({
    id: 'stem-skills-challenge', title: 'STEM Skills Challenge', domain: 'Data, math, and reasoning', format: 'assessment', listedQuestionCount: 5, practiceQuestionCount: 5,
    description: 'Solve mixed applied questions from mathematics, science, and engineering.',
    instructions: 'Use self-contained scenarios with supplied constants and no requirement for external lookup.',
    competencies: ['quantitative reasoning', 'scientific reasoning', 'units and estimation'],
    guidance: ['include one dimensional-analysis item', 'include one experimental-design item', 'show needed constants'],
    evaluationCriteria: ['correctness', 'method', 'units and assumptions'],
  }),

  makePreset({
    id: 'ai-fluency-interview', title: 'AI Fluency Interview', domain: 'AI and evaluation', format: 'interview', listedDurationMinutes: 24, practiceQuestionCount: 6,
    description: 'Explain how you use AI tools effectively while verifying outputs and respecting their limits.',
    instructions: 'Probe concrete workflows, prompt and context choices, verification, failure recognition, and responsible use.',
    competencies: ['AI workflows', 'verification', 'model limitations'],
    guidance: ['ask for a real before-and-after workflow', 'probe a failure', 'ask when AI should not be used'],
    evaluationCriteria: ['practical specificity', 'verification discipline', 'calibrated claims'],
  }),
  makePreset({
    id: 'ai-proficiency-interview', title: 'AI Proficiency Interview', domain: 'AI and evaluation', format: 'interview', listedDurationMinutes: 21, practiceQuestionCount: 6,
    description: 'Defend advanced AI system choices across prompting, evaluation, deployment, and risk.',
    instructions: 'Use a technically demanding applied scenario and probe model choice, context construction, evaluation, observability, and safeguards.',
    competencies: ['LLM system design', 'evaluation', 'responsible deployment'],
    guidance: ['require measurable evals', 'introduce a distribution shift', 'probe cost and latency tradeoffs'],
    evaluationCriteria: ['technical depth', 'evaluation rigor', 'risk-aware judgment'],
  }),
  makePreset({
    id: 'model-response-evaluation', title: 'Model Response Evaluation', domain: 'AI and evaluation', format: 'assessment', listedQuestionCount: 44, practiceQuestionCount: 8,
    description: 'Judge model outputs for correctness, instruction following, usefulness, and safety.',
    instructions: 'Create paired or single-response evaluation items with explicit user requests and a defensible answer guide.',
    competencies: ['response ranking', 'error detection', 'instruction following'],
    guidance: ['include subtle factual and reasoning defects', 'distinguish style from substance', 'include tied or both-bad cases'],
    evaluationCriteria: ['issue detection', 'ranking justification', 'rubric consistency'],
  }),

  makePreset({
    id: 'ocr-video-captioning', title: 'OCR Video Captioning', domain: 'Media and creative work', format: 'assessment', listedQuestionCount: 3, practiceQuestionCount: 3,
    description: 'Extract visible text and write temporally useful captions from simulated video frames.',
    instructions: 'Provide clearly labeled simulated frame sequences containing on-screen text, motion, and ambiguity.',
    competencies: ['OCR accuracy', 'temporal captioning', 'uncertainty handling'],
    guidance: ['label every stimulus simulated', 'include partially obscured text', 'separate visible text from inferred action'],
    evaluationCriteria: ['text fidelity', 'temporal clarity', 'appropriate uncertainty'],
  }),
  makePreset({
    id: 'visual-design-showcase', title: 'Visual Design Showcase', domain: 'Media and creative work', format: 'interview', listedDurationMinutes: 33, practiceQuestionCount: 7, supportsScreenShare: true,
    description: 'Present visual work on screen and defend the choices, constraints, and revisions behind it.',
    instructions: 'Invite a portfolio walkthrough, then probe audience, hierarchy, system decisions, critique, accessibility, and outcomes.',
    competencies: ['design rationale', 'visual hierarchy', 'critique response'],
    guidance: ['ask the candidate to point to evidence on screen', 'probe one rejected direction', 'ask about accessibility'],
    evaluationCriteria: ['clarity of rationale', 'craft awareness', 'response to constraints'],
  }),
  makePreset({
    id: 'visual-media-assessment', title: 'Visual Media Assessment', domain: 'Media and creative work', format: 'assessment', listedQuestionCount: 11, practiceQuestionCount: 8,
    description: 'Describe, compare, and evaluate visual scenes using simulated stimuli.',
    instructions: 'Create labeled text simulations of visual material and test observation, comparison, ambiguity, and quality judgment.',
    competencies: ['visual description', 'comparison', 'quality judgment'],
    guidance: ['label stimuli simulated', 'separate observation from inference', 'include a find-the-difference style item'],
    evaluationCriteria: ['observational accuracy', 'specificity', 'uncertainty calibration'],
  }),
  makePreset({
    id: 'voice-acting-interview', title: 'Voice Acting Interview', domain: 'Media and creative work', format: 'interview', listedDurationMinutes: 17, practiceQuestionCount: 5,
    description: 'Explain interpretation and performance choices while responding to direction.',
    instructions: 'Discuss vocal craft, preparation, characterization, recording practice, and adjustment after a concise direction note.',
    competencies: ['performance interpretation', 'direction response', 'vocal craft'],
    guidance: ['ask for two readings of a line when in voice mode', 'give one precise direction change', 'probe recording workflow'],
    evaluationCriteria: ['interpretive intent', 'adaptability', 'technical awareness'],
  }),
  makePreset({
    id: 'audio-media-assessment', title: 'Audio Media Assessment', domain: 'Media and creative work', format: 'assessment', listedQuestionCount: 4, practiceQuestionCount: 4,
    description: 'Analyze simulated audio descriptions for content, quality, and production issues.',
    instructions: 'Use clearly labeled simulated audio observations or production scenarios; do not imply actual audio playback.',
    competencies: ['audio description', 'quality detection', 'production judgment'],
    guidance: ['label stimuli simulated', 'include one speech and one music case', 'ask for evidence behind the judgment'],
    evaluationCriteria: ['specificity', 'technical correctness', 'evidence-based judgment'],
  }),
  makePreset({
    id: 'creative-prompt-writing', title: 'Creative Prompt Writing', domain: 'Media and creative work', format: 'assessment', listedQuestionCount: 2, practiceQuestionCount: 2,
    description: 'Write and revise prompts that satisfy creative constraints without flattening the idea.',
    instructions: 'Provide one creation brief and one revision brief with explicit audience, medium, constraints, and failure conditions.',
    competencies: ['creative direction', 'constraint handling', 'revision'],
    guidance: ['make success inspectable', 'avoid style imitation of living artists', 'require a purposeful revision'],
    evaluationCriteria: ['constraint coverage', 'clarity', 'creative usefulness'],
  }),
  makePreset({
    id: 'writing-interview', title: 'Writing Interview', domain: 'Media and creative work', format: 'interview', listedDurationMinutes: 19, practiceQuestionCount: 5,
    description: 'Explain editorial judgment, audience choices, research, drafting, and revision.',
    instructions: 'Probe one real writing project from brief through revision and ask the candidate to edit a short simulated passage aloud.',
    competencies: ['editorial judgment', 'audience awareness', 'revision process'],
    guidance: ['ask why a sentence stayed or went', 'probe evidence and sourcing', 'change the intended audience'],
    evaluationCriteria: ['editorial reasoning', 'clarity', 'adaptability'],
  }),

  makePreset({
    id: 'bilingual-competency', title: 'Bilingual Competency', domain: 'Professional domains', format: 'interview', listedDurationMinutes: 33, practiceQuestionCount: 7,
    description: 'Explain how meaning, register, and cultural context are preserved across languages.',
    instructions: 'Let the candidate name their language pair, then use translation decisions, ambiguity, register, and domain terminology.',
    competencies: ['meaning preservation', 'register', 'cross-cultural judgment'],
    guidance: ['ask for alternatives', 'probe an untranslatable phrase', 'change the audience and formality'],
    evaluationCriteria: ['semantic fidelity', 'register control', 'explanation of choices'],
  }),
  makePreset({
    id: 'law-interview', title: 'Law Interview', domain: 'Professional domains', format: 'interview', listedDurationMinutes: 28, practiceQuestionCount: 6,
    description: 'Practice issue spotting and bounded legal reasoning without presenting the exercise as legal advice.',
    instructions: 'Use a hypothetical fact pattern, ask for issues, competing arguments, missing facts, and a qualified recommendation.',
    competencies: ['issue spotting', 'argument structure', 'fact sensitivity'],
    guidance: ['change one material fact', 'ask for the strongest opposing argument', 'require uncertainty boundaries'],
    evaluationCriteria: ['issue coverage', 'reasoning quality', 'qualification and precision'],
  }),
  makePreset({
    id: 'finance-interview', title: 'Finance Interview', domain: 'Professional domains', format: 'interview', listedDurationMinutes: 30, practiceQuestionCount: 7,
    description: 'Reason through a financial scenario while exposing assumptions, sensitivities, and risk.',
    instructions: 'Use an applied valuation, markets, accounting, or risk scenario calibrated to the participant context.',
    competencies: ['financial reasoning', 'assumption management', 'risk analysis'],
    guidance: ['ask for a sensitivity', 'challenge one assumption', 'request a downside case'],
    evaluationCriteria: ['technical correctness', 'assumption clarity', 'risk awareness'],
  }),
  makePreset({
    id: 'clinical-case-study', title: 'Clinical Case Study', domain: 'Professional domains', format: 'interview', listedDurationMinutes: 23, practiceQuestionCount: 6,
    description: 'Structure a simulated clinical case while stating limits and avoiding unsupported certainty.',
    instructions: 'Present an educational hypothetical and ask for information gathering, differential structure, risk flags, and escalation. Do not request real-patient advice.',
    competencies: ['case structure', 'risk recognition', 'uncertainty communication'],
    guidance: ['ask what information is missing', 'probe a red flag', 'require an escalation threshold'],
    evaluationCriteria: ['structured reasoning', 'safety awareness', 'appropriate boundaries'],
  }),
  makePreset({
    id: 'consulting-interview', title: 'Consulting Interview', domain: 'Professional domains', format: 'interview', listedDurationMinutes: 33, practiceQuestionCount: 7,
    description: 'Structure an ambiguous business problem, analyze it, and synthesize a recommendation.',
    instructions: 'Use one original business case with supplied facts; require clarification, structure, analysis, tradeoffs, and final synthesis.',
    competencies: ['problem structuring', 'business judgment', 'synthesis'],
    guidance: ['provide data only when asked for it', 'challenge the initial structure', 'ask for a concise recommendation'],
    evaluationCriteria: ['structure quality', 'analysis', 'decision-ready synthesis'],
  }),
  makePreset({
    id: 'sports-expert-interview', title: 'Sports Expert Interview', domain: 'Professional domains', format: 'interview', listedDurationMinutes: 17, practiceQuestionCount: 5,
    description: 'Demonstrate sports-domain depth with evidence, context, and defensible comparisons.',
    instructions: 'Let the candidate define the sport and specialty, then probe tactics, history, evaluation, and one contested judgment.',
    competencies: ['sports expertise', 'evidence use', 'contextual comparison'],
    guidance: ['ask for a specific example', 'challenge recency bias', 'separate fact from interpretation'],
    evaluationCriteria: ['domain accuracy', 'depth', 'evidence-backed judgment'],
  }),
];

export const REHEARSAL_DOMAINS = [...new Set(REHEARSAL_PRESETS.map(preset => preset.domain))];

export function findRehearsalPresets(
  query = '',
  format: RehearsalFormat | 'all' = 'all',
  domain = 'all',
): RehearsalPreset[] {
  const needle = query.trim().toLowerCase();
  return REHEARSAL_PRESETS.filter(preset => {
    if (format !== 'all' && preset.format !== format) return false;
    if (domain !== 'all' && preset.domain !== domain) return false;
    if (!needle) return true;
    const haystack = [
      preset.title,
      preset.domain,
      preset.description,
      ...preset.competencies,
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

export function getRehearsalPreset(id: string): RehearsalPreset | undefined {
  return REHEARSAL_PRESETS.find(preset => preset.id === id);
}

export function createRehearsalSetup(
  preset: RehearsalPreset,
  participantContext: string,
): RehearsalSetup {
  return {
    kind: 'rehearsal',
    presetId: preset.id,
    title: preset.title,
    format: preset.format,
    domain: preset.domain,
    description: preset.description,
    instructions: preset.instructions,
    competencies: [...preset.competencies],
    guidance: [...preset.guidance],
    evaluationCriteria: [...preset.evaluationCriteria],
    targetQuestionCount: preset.practiceQuestionCount,
    supportsScreenShare: preset.supportsScreenShare,
    participantContext: participantContext.trim(),
  };
}
