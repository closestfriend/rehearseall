export type InterviewMode = 'text' | 'voice' | 'assessment';

export interface InterviewAuthorization {
  userId: string;
  mode: InterviewMode;
  sessionId: string;
  initial: boolean;
}

export interface EntitlementDecision {
  allowed: boolean;
  plan: 'free' | 'pro';
  used: number;
  remaining: number;
}

export interface CostEvent {
  userId: string;
  sessionId?: string;
  operation: string;
  mode?: InterviewMode;
  provider: string;
  model: string;
  succeeded: boolean;
  inputTokens?: number;
  outputTokens?: number;
  errorCode?: string;
}

export class CommercialError extends Error {
  constructor(public readonly code: 'server_misconfigured' | 'quota_exceeded' | 'upstream_error', message: string) {
    super(message);
    this.name = 'CommercialError';
  }
}

function config(): { baseUrl: string; serviceKey: string } {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new CommercialError('server_misconfigured', 'Supabase server configuration is incomplete');
  }
  return { baseUrl, serviceKey };
}

function monthlyLimits(): { free: number; pro: number } {
  const free = Number(process.env.FREE_MONTHLY_INTERVIEWS);
  const pro = Number(process.env.PRO_MONTHLY_INTERVIEWS);
  if (!Number.isInteger(free) || free < 0 || !Number.isInteger(pro) || pro < free) {
    throw new CommercialError('server_misconfigured', 'Interview limits are not configured');
  }
  return { free, pro };
}

async function postJson(path: string, body: unknown): Promise<Response> {
  const { baseUrl, serviceKey } = config();
  try {
    return await fetch(`${baseUrl}/rest/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('[commercial:provider_unreachable]', error);
    throw new CommercialError('upstream_error', 'Persistence provider unavailable');
  }
}

export async function authorizeInterview(input: InterviewAuthorization): Promise<EntitlementDecision> {
  const limits = monthlyLimits();
  const response = await postJson('rpc/authorize_interview', {
    p_user_id: input.userId,
    p_mode: input.mode,
    p_session_id: input.sessionId,
    p_initial: input.initial,
    p_free_limit: limits.free,
    p_pro_limit: limits.pro,
  });
  if (!response.ok) {
    console.error('[commercial:authorize_failed]', response.status);
    throw new CommercialError('upstream_error', 'Could not authorize interview');
  }
  const parsed = await response.json() as EntitlementDecision | EntitlementDecision[];
  const decision = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!decision || typeof decision.allowed !== 'boolean') {
    throw new CommercialError('upstream_error', 'Invalid authorization response');
  }
  if (!decision.allowed) throw new CommercialError('quota_exceeded', 'Interview quota exceeded');
  return decision;
}

export async function refundInterview(input: Omit<InterviewAuthorization, 'initial'>): Promise<boolean> {
  const response = await postJson('rpc/refund_interview', {
    p_user_id: input.userId,
    p_mode: input.mode,
    p_session_id: input.sessionId,
  });
  if (!response.ok) {
    console.error('[commercial:refund_failed]', response.status);
    throw new CommercialError('upstream_error', 'Could not refund interview quota');
  }
  const parsed = await response.json() as boolean | boolean[];
  return Array.isArray(parsed) ? parsed[0] === true : parsed === true;
}

export async function recordCostEvent(event: CostEvent): Promise<void> {
  try {
    const response = await postJson('cost_events', event);
    if (!response.ok) console.error('[commercial:cost_event_failed]', response.status);
  } catch (error) {
    // Cost accounting must not turn a completed rehearsal into a user-visible failure.
    console.error('[commercial:cost_event_failed]', error);
  }
}
