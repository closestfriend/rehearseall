const API_ROUTES: Record<string, string> = {
  '/api/health': '/api/health.ts',
  '/api/chat': '/api/chat.ts',
  '/api/evaluate': '/api/evaluate.ts',
  '/api/assessment-deck': '/api/assessment-deck.ts',
  '/api/evaluate-assessment': '/api/evaluate-assessment.ts',
  '/api/live-token': '/api/live-token.ts',
};

export function apiModuleForPath(pathname: string): string | null {
  return API_ROUTES[pathname] ?? null;
}
