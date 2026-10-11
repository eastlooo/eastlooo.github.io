export const SUPABASE_URL = 'https://tywockrstnlmqwxdhxvk.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5d29ja3JzdG5sbXF3eGRoeHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzY5NTcsImV4cCI6MjA4NjkxMjk1N30.Iv9xzgsqiNWTCTTgH-TysqEYD-90IEFb_OjX6BrpiTo';
export function normalizeCode(value) { return (value ?? '').trim().toUpperCase(); }
export function isCode(code) { return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code); }
export function appUrl(code) { return `https://eastlooo.github.io/c/?k=${encodeURIComponent(code)}`; }
export function isPublicKey(key) {
  if (key.startsWith('sb_publishable_')) return true;
  try {
    const payload = key.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded).role === 'anon';
  } catch { return false; }
}
export async function getChallenge(code, {url = SUPABASE_URL, key = SUPABASE_ANON_KEY, fetcher = fetch, now = Date.now()} = {}) {
  if (!isCode(code)) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || key.startsWith('__') || !key) throw new Error('configuration');
  // A publishable key is an apikey, not a user JWT. Never use a secret key here.
  if (!isPublicKey(key)) throw new Error('configuration');
  const response = await fetcher(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_challenge`, {
    method: 'POST', headers: {'Content-Type':'application/json', apikey:key},
    body: JSON.stringify({p_code:code}), signal: AbortSignal.timeout(10000),
    credentials: 'omit', referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error('load');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('load');
  if (!rows.length) return null;
  const challenge = rows[0];
  const expiry = Date.parse(challenge.expires_at);
  if (!Number.isFinite(expiry) || expiry <= now) return null;
  if (typeof challenge.sentence_snapshot !== 'string' || !challenge.sentence_snapshot.trim() || Array.from(challenge.sentence_snapshot).length > 12000) throw new Error('load');
  const visible = Number.isInteger(challenge.sender_kpm) && challenge.sender_kpm >= 0 && challenge.sender_kpm <= 3000 && Number.isFinite(Number(challenge.sender_accuracy)) && challenge.sender_accuracy != null && Number(challenge.sender_accuracy) >= 0 && Number(challenge.sender_accuracy) <= 100;
  // Explicit projection; a backend regression must never expose owner fields.
  return {sentence:challenge.sentence_snapshot, kpm:visible ? challenge.sender_kpm : null, accuracy:visible ? Number(challenge.sender_accuracy) : null, expiresAt:expiry};
}
