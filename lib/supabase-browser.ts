/** Browser-only Supabase adapter for the GitHub Pages rebuild.
 * Uses the publishable key, never a service-role key.
 * All table access remains protected by Supabase RLS.
 */
export const SUPABASE_URL = 'https://yqhfhpjthxcbbzdlisgt.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_J4ZxKqxJDRy8q6RtIacMWA_ORFXDcoY';
export type Session = { access_token: string; refresh_token: string; expires_in?: number; user?: { id: string; email?: string } };
const STORAGE_KEY = 'podporao-supabase-session';
const headers = (token?: string): HeadersInit => ({
  apikey: SUPABASE_PUBLISHABLE_KEY,
  'Content-Type': 'application/json',
  ...(token ? { Authorization: 'Bearer ' + token } : {}),
});
async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(SUPABASE_URL + path, {
    ...init, headers: { ...headers(token), ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.error_description || data.message || 'Požadavek se nezdařil.');
  return data as T;
}
export function currentSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}
function saveSession(session: Session | null) {
  if (typeof window === 'undefined') return;
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
}
export async function signIn(email: string, password: string) {
  const session = await request<Session>('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
  saveSession(session);
  return session;
}
export async function signUp(email: string, password: string, name: string) {
  return request<{ user?: { id: string }; session?: Session }>('/auth/v1/signup', {
    method: 'POST', body: JSON.stringify({
      email, password, data: { name },
      email_redirect_to: 'https://podporao.cz/potvrzeni',
    }),
  });
}
export async function resetPassword(email: string) {
  return request('/auth/v1/recover', {
    method: 'POST', body: JSON.stringify({ email }),
  });
}
export async function signOut() {
  const session = currentSession();
  try {
    if (session) await request('/auth/v1/logout', { method: 'POST' }, session.access_token);
  } finally { saveSession(null); }
}
export async function refreshSession() {
  const session = currentSession();
  if (!session?.refresh_token) return null;
  try {
    const next = await request<Session>('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    saveSession(next);
    return next;
  } catch { saveSession(null); return null; }
}
export async function getCurrentUser() {
  const session = currentSession();
  if (!session) return null;
  try { return await request<{ id: string; email?: string }>('/auth/v1/user', {}, session.access_token); }
  catch {
    const renewed = await refreshSession();
    return renewed ? request<{ id: string; email?: string }>('/auth/v1/user', {}, renewed.access_token) : null;
  }
}
export async function listPublishedProjects() {
  return request<Array<Record<string, unknown>>>(
    '/rest/v1/projects?select=id,slug,title,category,summary,image_url,published_at&status=eq.published&published_at=not.is.null&order=published_at.desc&limit=50',
  );
}
