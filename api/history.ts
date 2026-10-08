import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './_lib/cors';
import { requireUser } from './_lib/auth';
import { sendAuthError, sendError } from './_lib/http';
import { deleteHistory, listHistory, saveHistory } from './_lib/history';
import type { HistoryEntry } from '../types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  let user;
  try { user = await requireUser(req); }
  catch (error) { sendAuthError(res, error); return; }

  try {
    if (req.method === 'GET') {
      res.status(200).json({ history: await listHistory(user.id) });
      return;
    }
    if (req.method === 'POST') {
      const entry = (req.body ?? {}) as HistoryEntry;
      if (!entry.id || !entry.resume || !entry.feedback || !Array.isArray(entry.transcript)) {
        sendError(res, 400, 'bad_request');
        return;
      }
      await saveHistory(user.id, entry);
      res.status(204).end();
      return;
    }
    if (req.method === 'DELETE') {
      const id = typeof (req.body as { id?: unknown } | undefined)?.id === 'string'
        ? (req.body as { id: string }).id : '';
      if (!id) { sendError(res, 400, 'bad_request'); return; }
      await deleteHistory(user.id, id);
      res.status(204).end();
      return;
    }
    sendError(res, 405, 'method_not_allowed');
  } catch (error) {
    sendError(res, 500, 'server_misconfigured', error);
  }
}
