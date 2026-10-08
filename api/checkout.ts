import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { applyCors } from './_lib/cors';
import { requireUser } from './_lib/auth';
import { sendAuthError, sendError } from './_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  let user;
  try { user = await requireUser(req); }
  catch (error) { sendAuthError(res, error); return; }
  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRO_PRICE_ID;
  if (!secret || !price) return sendError(res, 500, 'server_misconfigured', 'Stripe checkout configuration is incomplete');
  try {
    const stripe = new Stripe(secret);
    const origin = process.env.APP_URL || `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers.host ?? ''}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      customer_email: user.email,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
    });
    res.status(200).json({ url: session.url });
  } catch (error) {
    sendError(res, 502, 'upstream_error', error);
  }
}
