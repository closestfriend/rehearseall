import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { supabaseAdmin, ensurePersistenceOk } from './_lib/supabaseAdmin';

export const config = { api: { bodyParser: false } };

async function rawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req as any) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function setPlan(userId: string, plan: 'free' | 'pro', customerId?: string): Promise<void> {
  const { response } = await supabaseAdmin('profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: userId, plan, ...(customerId ? { stripe_customer_id: customerId } : {}) }),
  });
  ensurePersistenceOk(response, 'set_plan');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];
  if (!secret || !webhookSecret || typeof signature !== 'string') { res.status(500).json({ error: 'server_misconfigured' }); return; }
  try {
    const stripe = new Stripe(secret);
    const event = stripe.webhooks.constructEvent(await rawBody(req), signature, webhookSecret);
    const claimed = await supabaseAdmin<boolean | boolean[]>('rpc/claim_webhook_event', {
      method: 'POST',
      body: JSON.stringify({ p_event_id: event.id }),
    });
    ensurePersistenceOk(claimed.response, 'record_webhook');
    const didClaim = Array.isArray(claimed.body) ? claimed.body[0] : claimed.body;
    if (didClaim !== true) { res.status(200).json({ received: true, duplicate: true }); return; }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (userId) await setPlan(userId, 'pro', typeof session.customer === 'string' ? session.customer : undefined);
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      if (userId) await setPlan(userId, event.type === 'customer.subscription.deleted' || subscription.status !== 'active' ? 'free' : 'pro');
    }
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[stripe:webhook_failed]', error);
    res.status(400).json({ error: 'invalid_webhook' });
  }
}
