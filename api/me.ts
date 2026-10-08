import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './_lib/cors';
import { requireUser } from './_lib/auth';
import { sendAuthError, sendError } from './_lib/http';
import { supabaseAdmin, ensurePersistenceOk } from './_lib/supabaseAdmin';

function limit(name: string): number | null {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
  let user;
  try { user = await requireUser(req); }
  catch (error) { sendAuthError(res, error); return; }
  try {
    const profile = await supabaseAdmin<Array<{ plan: 'free' | 'pro' }>>(
      `profiles?id=eq.${encodeURIComponent(user.id)}&select=plan`,
      { headers: { Accept: 'application/json' } },
    );
    ensurePersistenceOk(profile.response, 'get_profile');
    const plan = profile.body?.[0]?.plan ?? 'free';
    const usage = await supabaseAdmin<unknown[]>(
      `usage_events?user_id=eq.${encodeURIComponent(user.id)}&kind=eq.interview_start&created_at=gte.${encodeURIComponent(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())}&select=id`,
      { headers: { Accept: 'application/json', Prefer: 'count=exact' } },
    );
    ensurePersistenceOk(usage.response, 'get_usage');
    const range = usage.response.headers.get('content-range') ?? '';
    const used = Number(range.split('/')[1]) || usage.body?.length || 0;
    const monthlyLimit = plan === 'pro' ? limit('PRO_MONTHLY_INTERVIEWS') : limit('FREE_MONTHLY_INTERVIEWS');
    res.status(200).json({ plan, used, remaining: monthlyLimit === null ? null : Math.max(monthlyLimit - used, 0) });
  } catch (error) {
    sendError(res, 500, 'server_misconfigured', error);
  }
}
