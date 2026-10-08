import type { HistoryEntry } from '../../types';
import { ensurePersistenceOk, supabaseAdmin } from './supabaseAdmin';

interface HistoryRow {
  id: string;
  user_id: string;
  payload: HistoryEntry;
  created_at: string;
}

export async function listHistory(userId: string): Promise<HistoryEntry[]> {
  const { response, body } = await supabaseAdmin<HistoryRow[]>(
    `history?user_id=eq.${encodeURIComponent(userId)}&select=payload&order=created_at.desc`,
    { headers: { Accept: 'application/json' } },
  );
  ensurePersistenceOk(response, 'list_history');
  return (body ?? []).map(row => row.payload).filter(Boolean);
}

export async function saveHistory(userId: string, entry: HistoryEntry): Promise<void> {
  const { response } = await supabaseAdmin('history', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: entry.id, user_id: userId, payload: entry, score: entry.feedback.score, mode: entry.mode ?? null }),
  });
  ensurePersistenceOk(response, 'save_history');
}

export async function deleteHistory(userId: string, id: string): Promise<void> {
  const { response } = await supabaseAdmin(
    `history?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
  ensurePersistenceOk(response, 'delete_history');
}
