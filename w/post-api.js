import {
  devicePlatform,
  isPublicKey,
  storeUrl,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "../c/challenge-api.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isPostId(id) {
  return typeof id === "string" && UUID.test(id.trim());
}
export function normalizePostId(value) {
  return (value ?? "").trim().toLowerCase();
}
export function postSchemeUrl(id) {
  return `com.dongcheon.tadak:///w?id=${encodeURIComponent(id)}`;
}
export function postOpenUrl(id, ua, touchPoints = 0) {
  if (
    devicePlatform(ua, touchPoints) === "android" &&
    /Chrome|KAKAOTALK/i.test(ua)
  ) {
    return `intent://w?id=${
      encodeURIComponent(id)
    }#Intent;scheme=com.dongcheon.tadak;package=com.dongcheon.tadak;S.browser_fallback_url=${
      encodeURIComponent(storeUrl("android"))
    };end`;
  }
  return postSchemeUrl(id);
}
/** First [max] non-empty lines; the last one is cut with an ellipsis when more follow. */
export function previewLines(content, max = 6, maxChars = 90) {
  const all = String(content ?? "").split(/\r?\n/).map((l) => l.trim()).filter(
    Boolean,
  );
  const lines = all.slice(0, max).map((l) => {
    const chars = Array.from(l);
    return chars.length > maxChars ? chars.slice(0, maxChars).join("") + "…" : l;
  });
  const cut = all.length > max;
  if (cut && lines.length) lines[lines.length - 1] += "…";
  return { lines, cut };
}
export function authorLabel(profile) {
  const nick = profile?.nickname;
  if (typeof nick !== "string" || !nick.trim()) return "";
  const tag = profile?.nickname_tag;
  return tag != null && String(tag).trim()
    ? `${nick.trim()}#${String(tag).trim().replace(/^#+/, "")}`
    : nick.trim();
}
/** Zero/missing parts are dropped. [t] supplies localized templates. */
export function statsParts(post, t) {
  const parts = [];
  if (post.likes > 0) parts.push(t.likes(post.likes));
  if (post.imports > 0) parts.push(t.imports(post.imports));
  if (post.practice > 0) parts.push(t.practice(post.practice));
  return parts;
}
const count = (v) => Number.isInteger(v) && v >= 0 ? v : 0;
export async function getPost(
  id,
  { url = SUPABASE_URL, key = SUPABASE_ANON_KEY, fetcher = fetch } = {},
) {
  if (!isPostId(id)) return null;
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !key ||
    key.startsWith("__") || !isPublicKey(key)
  ) throw new Error("configuration");
  const response = await fetcher(
    `${url.replace(/\/$/, "")}/rest/v1/rpc/get_community_post`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ p_id: id }),
      signal: AbortSignal.timeout(10000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    },
  );
  if (!response.ok) throw new Error("load");
  let data = await response.json();
  if (Array.isArray(data)) data = data[0];
  if (data == null || typeof data !== "object") return null;
  if (
    typeof data.title !== "string" || !data.title.trim() ||
    typeof data.content !== "string" || !data.content.trim() ||
    Array.from(data.content).length > 20000
  ) return null;
  // Explicit projection: never pass through owner ids or anything unexpected.
  return {
    id: String(data.id ?? id),
    title: data.title.trim(),
    artist: typeof data.artist === "string" ? data.artist.trim() : "",
    content: data.content,
    likes: count(data.likes_count),
    imports: count(data.imports_count),
    practice: count(data.practice_count),
    author: authorLabel(data.profiles),
  };
}
