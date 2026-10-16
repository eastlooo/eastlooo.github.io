/// <reference lib="dom" />
import {
  authorLabel,
  getPost,
  isPostId,
  normalizePostId,
  postOpenUrl,
  postSchemeUrl,
  previewLines,
  statsParts,
} from "../w/post-api.js";
function assert(ok: unknown, message = "assertion failed"): asserts ok {
  if (!ok) throw new Error(message);
}
const id = "3f2b8a52-6c1d-4b8e-9a77-0d2c5e9f1a44";
const t = {
  likes: (n: number) => `좋아요 ${n}`,
  imports: (n: number) => `가져감 ${n}`,
  practice: (n: number) => `${n}명이 쳤어요`,
};
Deno.test("post id validation", () => {
  assert(isPostId(id));
  assert(isPostId(id.toUpperCase()));
  assert(!isPostId("nope"));
  assert(!isPostId(`${id}x`));
  assert(!isPostId(null as unknown as string));
  assert(normalizePostId(` ${id.toUpperCase()} `) === id);
});
Deno.test("app urls", () => {
  assert(postSchemeUrl(id) === `com.dongcheon.tadak:///w?id=${id}`);
  const ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
  assert(postOpenUrl(id, ios) === postSchemeUrl(id));
  const android = "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile";
  const intent = postOpenUrl(id, android);
  assert(intent.startsWith(`intent://w?id=${id}#Intent;scheme=com.dongcheon.tadak;package=com.dongcheon.tadak;`));
  assert(intent.includes("S.browser_fallback_url=https%3A%2F%2Fplay.google.com"));
  assert(postOpenUrl(id, "Mozilla/5.0 (Linux; Android 14) Firefox/120") === postSchemeUrl(id));
});
Deno.test("preview lines clip", () => {
  const short = previewLines("a\nb\n\n c ");
  assert(short.lines.join("|") === "a|b|c" && !short.cut);
  const long = previewLines(Array.from({ length: 9 }, (_, i) => `줄${i}`).join("\n"));
  assert(long.lines.length === 6 && long.cut && long.lines[5] === "줄5…");
  const wide = previewLines("가".repeat(200), 6, 10);
  assert(Array.from(wide.lines[0]).length === 11 && wide.lines[0].endsWith("…"));
  assert(previewLines(null).lines.length === 0);
});
Deno.test("author and stats", () => {
  assert(authorLabel({ nickname: "하늘", nickname_tag: "1234" }) === "하늘#1234");
  assert(authorLabel({ nickname: "하늘" }) === "하늘");
  assert(authorLabel(null) === "");
  assert(statsParts({ likes: 3, imports: 0, practice: 12 }, t).join(" · ") === "좋아요 3 · 12명이 쳤어요");
  assert(statsParts({ likes: 0, imports: 0, practice: 0 }, t).length === 0);
});
const options = (body: unknown, ok = true) => ({
  url: "https://testproject.supabase.co",
  key: "sb_publishable_test",
  fetcher: async (u: RequestInfo | URL, init?: RequestInit) => {
    assert(String(u).endsWith("/rest/v1/rpc/get_community_post"));
    assert(init && init.method === "POST" && init.credentials === "omit");
    assert(JSON.parse(init.body as string).p_id === id);
    assert(!("Authorization" in (init.headers as Record<string, string>)));
    return ok ? Response.json(body) : new Response("x", { status: 500 });
  },
});
Deno.test("getPost projects only public fields", async () => {
  const post = await getPost(id, options({
    id, title: " 제목 ", artist: "작가", content: "본문", likes_count: 4,
    imports_count: -1, user_id: "must-not-leak", profiles: { nickname: "닉", nickname_tag: "01" },
  }));
  assert(post && post.title === "제목" && post.likes === 4 && post.imports === 0);
  assert(post.author === "닉#01" && !("user_id" in post));
});
Deno.test("getPost not found and errors", async () => {
  assert(await getPost(id, options(null)) === null);
  assert(await getPost(id, options([])) === null);
  assert(await getPost(id, options({ title: "", content: "x" })) === null);
  assert(await getPost("bad", options(null)) === null);
  let failed = false;
  try { await getPost(id, options({}, false)); } catch { failed = true; }
  assert(failed);
  let cfg = false;
  try { await getPost(id, { ...options({}), url: "http://evil.example" }); } catch { cfg = true; }
  assert(cfg);
});

Deno.test("authorLabel does not double a tag that already starts with #", () => {
  if (authorLabel({ nickname: "닉", nickname_tag: "#QA0L" }) !== "닉#QA0L") {
    throw new Error("double hash");
  }
});
