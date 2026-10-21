import type { ConversationSetup } from '../types';

// One shared skill vocabulary across every scenario, so "your weakest skill"
// means the same thing whether you rehearsed a raise or an apology.
export const COMPETENCIES = [
  'Clarity',
  'Making the ask',
  'Handling pushback',
  'Listening',
  'Empathy',
  'Composure',
  'Concision',
  'Evidence',
] as const;

export type Competency = (typeof COMPETENCIES)[number];

export interface Scenario {
  id: string;
  title: string;
  counterpart: string;
  goal: string;
  context: string;
  competencies: Competency[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'ask-for-a-raise',
    title: 'Ask your manager for a raise',
    counterpart: 'Your manager, who rates your work but is protecting a tight budget this year',
    goal: 'Leave with a specific number on the table or a dated plan to get there',
    context: 'You have taken on more scope over the last year without a title or pay change.',
    competencies: ['Making the ask', 'Evidence', 'Handling pushback', 'Composure'],
  },
  {
    id: 'negotiate-an-offer',
    title: 'Negotiate a job offer',
    counterpart: 'A recruiter who has made you an offer below your target and says the band is fixed',
    goal: 'Improve the offer without putting it at risk',
    context: 'You want the job. The base salary is about 10% under what you asked for.',
    competencies: ['Making the ask', 'Evidence', 'Handling pushback', 'Concision'],
  },
  {
    id: 'give-hard-feedback',
    title: 'Give hard feedback to someone on your team',
    counterpart: 'A well-liked teammate whose missed deadlines are starting to hurt the team',
    goal: 'Name the problem clearly and agree on what changes next',
    context: 'Two deliverables slipped this month. They have not raised it themselves.',
    competencies: ['Clarity', 'Empathy', 'Listening', 'Composure'],
  },
  {
    id: 'push-back-on-a-deadline',
    title: 'Push back on an unrealistic deadline',
    counterpart: 'A senior stakeholder who has already promised the date to a client',
    goal: 'Reset expectations to a date you can actually hit, or cut scope',
    context: 'The work as scoped needs about three more weeks than the promised date allows.',
    competencies: ['Clarity', 'Evidence', 'Handling pushback', 'Making the ask'],
  },
  {
    id: 'pitch-a-skeptical-investor',
    title: 'Pitch a skeptical investor',
    counterpart: 'An investor who has heard a hundred pitches shaped like yours',
    goal: 'Earn a second meeting',
    context: 'You have ten minutes and early traction, but no revenue yet.',
    competencies: ['Concision', 'Evidence', 'Handling pushback', 'Clarity'],
  },
  {
    id: 'tell-a-client-it-is-late',
    title: 'Tell a client the project will be late',
    counterpart: 'A client who is counting on the launch date for their own announcement',
    goal: 'Deliver the news early and leave with an agreed recovery plan',
    context: 'A dependency slipped. You can ship a reduced version on time or the full version two weeks late.',
    competencies: ['Clarity', 'Empathy', 'Composure', 'Making the ask'],
  },
  {
    id: 'set-a-boundary',
    title: 'Set a boundary with a colleague',
    counterpart: 'A friendly colleague who keeps volunteering you for extra work',
    goal: 'Stop the pattern without damaging the relationship',
    context: 'It has happened three times this quarter, most recently in front of your lead.',
    competencies: ['Making the ask', 'Clarity', 'Composure', 'Empathy'],
  },
  {
    id: 'own-a-mistake',
    title: 'Own a mistake',
    counterpart: 'A collaborator whose work was set back by your error',
    goal: 'Take responsibility without over-apologizing and agree on the repair',
    context: 'You shipped the wrong file version and they lost a day of work.',
    competencies: ['Clarity', 'Empathy', 'Listening', 'Composure'],
  },
  {
    id: 'pitch-a-gallery',
    title: 'Ask a gallery to show your work',
    counterpart: 'A gallerist who is generous with time but rarely takes on new artists',
    goal: 'Get a studio visit or a clear next step',
    context: 'You have a coherent body of new work and one prior group show.',
    competencies: ['Concision', 'Evidence', 'Making the ask', 'Handling pushback'],
  },
];

export const DEFAULT_COMPETENCIES: Competency[] = ['Clarity', 'Listening', 'Handling pushback', 'Making the ask'];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find(s => s.id === id);
}

export interface CustomScenarioInput {
  counterpart: string;
  goal: string;
  title?: string;
}

/**
 * Turns a preset (or an ad-hoc "rehearse telling my landlord I'm moving out")
 * into the ConversationSetup the existing RehearseAll prompts already understand.
 */
export function toConversationSetup(
  scenario: Pick<Scenario, 'title' | 'counterpart' | 'goal' | 'context'>,
  details?: string,
  worry?: string,
): ConversationSetup {
  const extra = details?.trim();
  return {
    kind: 'conversation',
    title: scenario.title,
    counterpart: scenario.counterpart,
    goal: scenario.goal,
    context: extra ? `${scenario.context}\nDetails from the user: ${extra}`.trim() : scenario.context,
    concern: worry?.trim() || undefined,
  };
}

export function customScenario(input: CustomScenarioInput): Scenario {
  return {
    id: 'custom',
    title: input.title?.trim() || `Conversation with ${input.counterpart.trim()}`,
    counterpart: input.counterpart.trim(),
    goal: input.goal.trim(),
    context: '',
    competencies: DEFAULT_COMPETENCIES,
  };
}
