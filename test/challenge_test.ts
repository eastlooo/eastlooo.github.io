/// <reference lib="dom" />
import {
  appSchemeUrl,
  appUrl,
  collectSignals,
  createInviteFlow,
  externalBrowserUrl,
  getChallenge,
  isCode,
  isPublicKey,
  normalizeCode,
  openUrl,
  recordInvite,
  storeUrl,
} from "../c/challenge-api.js";
function assert(ok: unknown, message = "assertion failed"): asserts ok {
  if (!ok) throw new Error(message);
}
const now = Date.UTC(2026, 9, 11);
const valid = {
  sentence_snapshot: "첫 문장.\n두 번째 문장.",
  sender_kpm: 321,
  sender_accuracy: 98.5,
  expires_at: new Date(now + 86400000).toISOString(),
  created_by: "must-not-leak",
};
const options = (rows: unknown) => ({
  url: "https://testproject.supabase.co",
  key: "sb_publishable_test",
  now,
  fetcher: async (_: RequestInfo | URL, init?: RequestInit) => {
    assert(init);
    assert(
      (init.headers as Record<string, string>).apikey === "sb_publishable_test",
    );
    assert(!("Authorization" in (init.headers as Record<string, string>)));
    assert(init.credentials === "omit");
    assert(JSON.parse(init.body as string).p_code === "ABCDEFGH");
    return Response.json(rows);
  },
});
Deno.test("code validation and canonical app URL", () => {
  assert(normalizeCode(" abcdefgh ") === "ABCDEFGH");
  assert(isCode("ABCDEFGH"));
  for (const value of ["ABC", "ABCDEFG0", "ABCDEFGI", "ABCDEFG1", "ABCD<>&!"]) {
    assert(!isCode(value));
  }
  assert(appUrl("ABCDEFGH") === "com.dongcheon.tadak:///c?k=ABCDEFGH");
});
Deno.test("reads anonymous RPC and projects only public UI fields", async () => {
  const result = await getChallenge("ABCDEFGH", options([valid]));
  assert(result?.sentence === valid.sentence_snapshot);
  assert(result?.kpm === 321);
  assert(result?.accuracy === 98.5);
  assert(!("created_by" in result));
});
Deno.test("hidden records and malicious markup remain plain strings", async () => {
  const result = await getChallenge(
    "ABCDEFGH",
    options([{
      ...valid,
      sender_kpm: null,
      sender_accuracy: null,
      sentence_snapshot: "<img src=x onerror=alert(1)>",
    }]),
  );
  assert(result?.kpm === null && result?.accuracy === null);
  assert(result?.sentence.startsWith("<img"));
});
Deno.test("invalid unknown expired and exact expiry boundary", async () => {
  assert(await getChallenge("invalid") === null);
  assert(await getChallenge("ABCDEFGH", options([])) === null);
  assert(
    await getChallenge(
      "ABCDEFGH",
      options([{ ...valid, expires_at: new Date(now).toISOString() }]),
    ) === null,
  );
});
Deno.test("network failures are distinct from expired challenges", async () => {
  let failed = false;
  try {
    await getChallenge("ABCDEFGH", {
      ...options([]),
      fetcher: async () => new Response("", { status: 429 }),
    });
  } catch {
    failed = true;
  }
  assert(failed);
});
Deno.test("placeholders fail without a network call", async () => {
  let called = false;
  let failed = false;
  try {
    await getChallenge("ABCDEFGH", {
      url: "__SUPABASE_URL__",
      key: "__SUPABASE_ANON_KEY__",
      fetcher: async () => {
        called = true;
        return Response.json([]);
      },
    });
  } catch {
    failed = true;
  }
  assert(failed && !called);
});
Deno.test("association files and store links use exact platform identifiers", async () => {
  const apple = JSON.parse(
    await Deno.readTextFile(
      new URL("../.well-known/apple-app-site-association", import.meta.url),
    ),
  );
  assert(
    apple.applinks.details[0].appIDs[0] === "3CZP576P62.com.dongcheon.Tadak",
  );
  assert(apple.applinks.details[0].components[0]["/"] === "/c/*");
  const android = JSON.parse(
    await Deno.readTextFile(
      new URL("../.well-known/assetlinks.json", import.meta.url),
    ),
  );
  assert(android[0].target.package_name === "com.dongcheon.tadak");
  const html = await Deno.readTextFile(
    new URL("../c/index.html", import.meta.url),
  );
  const api = await Deno.readTextFile(
    new URL("../c/challenge-api.js", import.meta.url),
  );
  assert(html.includes("id6443688240"));
  assert(api.includes("id6443688240") && api.includes("id=com.dongcheon.tadak"));
});

Deno.test("only public keys can enter REST headers", () => {
  assert(isPublicKey("sb_publishable_test"));
  assert(!isPublicKey("sb_secret_test"));
  const key = (role: string) =>
    `eyJheader.${btoa(JSON.stringify({ role }))}.signature`;
  assert(isPublicKey(key("anon")));
  assert(!isPublicKey(key("service_role")));
});

const ios =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit Safari";
const android =
  "Mozilla/5.0 (Linux; Android 16; Pixel 9) Chrome/140.0 Mobile Safari";
const signals = {
  screen_width: 390,
  screen_height: 844,
  device_pixel_ratio: 3,
  timezone: "Asia/Seoul",
  language: "ko-KR",
  platform: "ios",
  os_major: 26,
};
Deno.test("scheme, Android intent, stores and Kakao external URLs", () => {
  assert(appSchemeUrl("ABCD&EFG").endsWith("ABCD%26EFG"));
  assert(openUrl("ABCDEFGH", ios) === appSchemeUrl("ABCDEFGH"));
  assert(openUrl("ABCDEFGH", ios + " KAKAOTALK") === appSchemeUrl("ABCDEFGH"));
  for (const ua of [android, "Android 16 KAKAOTALK"]) {
    const url = openUrl("ABCDEFGH", ua);
    assert(url.startsWith("intent://c?k=ABCDEFGH#Intent;"));
    assert(
      url.includes("scheme=com.dongcheon.tadak;package=com.dongcheon.tadak;"),
    );
    assert(
      url.includes(
        "S.browser_fallback_url=" + encodeURIComponent(storeUrl("android")),
      ),
    );
  }
  assert(storeUrl("ios").includes("id6443688240"));
  const href = "https://eastlooo.github.io/c/?k=ABCDEFGH&via=link";
  assert(
    externalBrowserUrl(href) ===
      "kakaotalk://web/openExternal?url=" + encodeURIComponent(href),
  );
});
Deno.test("browser signals use full screen rather than viewport and detect mobile OS", () => {
  const collect = (ua: string, touchPoints = 0) =>
    collectSignals({
      nav: {
        userAgent: ua,
        maxTouchPoints: touchPoints,
        language: "ko-KR",
      } as unknown as Navigator,
      screenInfo: { width: 390, height: 844 } as Screen,
      dpr: 3,
      timezone: "Asia/Seoul",
    });
  assert(JSON.stringify(collect(ios)) === JSON.stringify(signals));
  assert(
    collect(android).platform === "android" && collect(android).os_major === 16,
  );
  assert(collect("Macintosh Safari", 5).platform === "ios");
  assert(collect("Macintosh Safari", 5).os_major === null);
  assert(collect("Windows Chrome").platform === null);
});
Deno.test("record posts only bounded fingerprint payload to anonymous RPC", async () => {
  let called = false;
  await recordInvite("ABCDEFGH", signals, {
    url: "https://testproject.supabase.co",
    key: "sb_publishable_test",
    fetcher: async (url: RequestInfo | URL, init?: RequestInit) => {
      called = true;
      assert(String(url).endsWith("/rest/v1/rpc/record_challenge_invite"));
      assert(init?.credentials === "omit" && init.keepalive === true);
      assert(
        (init?.headers as Record<string, string>).apikey ===
          "sb_publishable_test",
      );
      assert(!("Authorization" in (init?.headers as Record<string, string>)));
      const body = JSON.parse(init?.body as string);
      assert(
        body.p_code === "ABCDEFGH" &&
          JSON.stringify(body.p_signals) === JSON.stringify(signals),
      );
      assert(!("ip" in body.p_signals));
      return new Response(null, { status: 204 });
    },
  });
  assert(called);
});
Deno.test("invalid codes, unsupported devices and secret keys cannot record", async () => {
  let called = false;
  const fetcher = async () => {
    called = true;
    return new Response(null, { status: 204 });
  };
  await recordInvite("BAD", signals, { fetcher });
  await recordInvite("ABCDEFGH", { ...signals, platform: null }, { fetcher });
  let failed = false;
  try {
    await recordInvite("ABCDEFGH", signals, {
      key: "sb_secret_invalid",
      fetcher,
    });
  } catch {
    failed = true;
  }
  assert(failed && !called);
});
function flowHarness(record = async (_code: string, _signals: unknown) => {}) {
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const win = new EventTarget();
  const navigations: string[] = [];
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let next = 0;
  const flow = createInviteFlow({
    code: "ABCDEFGH",
    signals,
    ua: ios,
    doc: doc as unknown as Document,
    win: win as unknown as typeof window,
    navigate: (url: string) => navigations.push(url),
    record,
    schedule: ((fn: () => void, ms: number) => {
      timers.set(++next, { fn, ms });
      return next;
    }) as unknown as typeof setTimeout,
    cancel: ((id: number) => {
      timers.delete(id);
    }) as typeof clearTimeout,
  });
  const tick = (ms: number) => {
    for (const [id, t] of [...timers]) {
      if (t.ms === ms) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  return { flow, doc, win, navigations, timers, tick };
}
Deno.test("open records immediately, preserves tap navigation and falls back at 1600ms", () => {
  let called = false;
  const h = flowHarness(async () => {
    called = true;
  });
  h.flow.open();
  assert(called && h.navigations[0] === appSchemeUrl("ABCDEFGH"));
  h.tick(1600);
  assert(h.navigations[1] === storeUrl("ios"));
  assert(h.timers.size === 0);
});
Deno.test("hidden and pagehide cancel fallback even after returning to the page", () => {
  for (const event of ["visibilitychange", "pagehide"]) {
    const h = flowHarness();
    h.flow.open();
    if (event === "visibilitychange") {
      h.doc.visibilityState = "hidden";
      h.doc.dispatchEvent(new Event(event));
    } else h.win.dispatchEvent(new Event(event));
    h.doc.visibilityState = "visible";
    h.tick(1600);
    assert(h.navigations.length === 1 && h.timers.size === 0);
  }
});
Deno.test("repeated taps keep only one fallback and recording failure still opens", async () => {
  const h = flowHarness(async () => {
    throw new Error("offline");
  });
  h.flow.open();
  h.flow.open();
  assert(h.timers.size === 1);
  h.tick(1600);
  assert(h.navigations.length === 3);
  await Promise.resolve();
});
Deno.test("install waits for recording, but a hung request cannot delay it past 800ms", async () => {
  let done: () => void = () => {};
  const h = flowHarness(() =>
    new Promise<void>((resolve) => {
      done = resolve;
    })
  );
  const install = h.flow.install();
  await Promise.resolve();
  assert(h.navigations.length === 0);
  h.tick(800);
  await install;
  assert(h.navigations[0] === storeUrl("ios"));
  done();
  const success = flowHarness();
  await success.flow.install();
  assert(
    success.navigations[0] === storeUrl("ios") && success.timers.size === 0,
  );
});
