export interface SupabaseBrowserConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseBrowserConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== 'string' || !url || typeof anonKey !== 'string' || !anonKey) return null;
  return { url, anonKey };
}
