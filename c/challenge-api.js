export const SUPABASE_URL = "https://tywockrstnlmqwxdhxvk.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5d29ja3JzdG5sbXF3eGRoeHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzY5NTcsImV4cCI6MjA4NjkxMjk1N30.Iv9xzgsqiNWTCTTgH-TysqEYD-90IEFb_OjX6BrpiTo";
export function normalizeCode(value) {
  return (value ?? "").trim().toUpperCase();
}
export function isCode(code) {
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code);
}
export function appSchemeUrl(code) {
  return `com.dongcheon.tadak:///c?k=${encodeURIComponent(code)}`;
}
export const appUrl = appSchemeUrl;
export function storeUrl(platform) {
  return platform === "android"
    ? "https://play.google.com/store/apps/details?id=com.dongcheon.tadak"
    : "https://apps.apple.com/app/id6443688240";
}
export function devicePlatform(ua, touchPoints = 0) {
  if (/Android/i.test(ua)) return "android";
  if (
    /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)
  ) return "ios";
  return null;
}
export function collectSignals(
  {
    nav = navigator,
    screenInfo = screen,
    dpr = devicePixelRatio,
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  } = {},
) {
  const ua = nav.userAgent;
  const platform = devicePlatform(ua, nav.maxTouchPoints);
  const major =
    (platform === "android"
      ? /Android\s+(\d+)/i
      : /(?:CPU(?: iPhone)? OS|iPhone OS)\s+(\d+)/i).exec(ua);
  return {
    screen_width: Math.round(screenInfo.width),
    screen_height: Math.round(screenInfo.height),
    device_pixel_ratio: Number(dpr.toFixed(6)),
    timezone,
    language: nav.language,
    platform,
    os_major: major ? Number(major[1]) : null,
  };
}
export function openUrl(code, ua, touchPoints = 0) {
  if (
    devicePlatform(ua, touchPoints) === "android" &&
    /Chrome|KAKAOTALK/i.test(ua)
  ) {
    return `intent://c?k=${
      encodeURIComponent(code)
    }#Intent;scheme=com.dongcheon.tadak;package=com.dongcheon.tadak;S.browser_fallback_url=${
      encodeURIComponent(storeUrl("android"))
    };end`;
  }
  return appSchemeUrl(code);
}
export function externalBrowserUrl(url) {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}

export function isPublicKey(key) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    const payload = key.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded).role === "anon";
  } catch {
    return false;
  }
}
export async function getChallenge(
  code,
  {
    url = SUPABASE_URL,
    key = SUPABASE_ANON_KEY,
    fetcher = fetch,
    now = Date.now(),
  } = {},
) {
  if (!isCode(code)) return null;
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) ||
    key.startsWith("__") || !key
  ) throw new Error("configuration");
  // A publishable key is an apikey, not a user JWT. Never use a secret key here.
  if (!isPublicKey(key)) throw new Error("configuration");
  const response = await fetcher(
    `${url.replace(/\/$/, "")}/rest/v1/rpc/get_challenge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ p_code: code }),
      signal: AbortSignal.timeout(10000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    },
  );
  if (!response.ok) throw new Error("load");
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("load");
  if (!rows.length) return null;
  const challenge = rows[0];
  const expiry = Date.parse(challenge.expires_at);
  if (!Number.isFinite(expiry) || expiry <= now) return null;
  if (
    typeof challenge.sentence_snapshot !== "string" ||
    !challenge.sentence_snapshot.trim() ||
    Array.from(challenge.sentence_snapshot).length > 12000
  ) throw new Error("load");
  const visible = Number.isInteger(challenge.sender_kpm) &&
    challenge.sender_kpm >= 0 && challenge.sender_kpm <= 3000 &&
    Number.isFinite(Number(challenge.sender_accuracy)) &&
    challenge.sender_accuracy != null &&
    Number(challenge.sender_accuracy) >= 0 &&
    Number(challenge.sender_accuracy) <= 100;
  // Explicit projection; a backend regression must never expose owner fields.
  return {
    sentence: challenge.sentence_snapshot,
    kpm: visible ? challenge.sender_kpm : null,
    accuracy: visible ? Number(challenge.sender_accuracy) : null,
    expiresAt: expiry,
  };
}

// Shares the same public-key validation as preview; best effort and no cookies.
export async function recordInvite(
  code,
  signals,
  { url = SUPABASE_URL, key = SUPABASE_ANON_KEY, fetcher = fetch } = {},
) {
  if (!isCode(code) || !["ios", "android"].includes(signals.platform)) return;
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !isPublicKey(key)
  ) throw new Error("configuration");
  const response = await fetcher(
    `${url.replace(/\/$/, "")}/rest/v1/rpc/record_challenge_invite`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ p_code: code, p_signals: signals }),
      signal: AbortSignal.timeout(800),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
    },
  );
  if (!response.ok) throw new Error("record");
}

export function createInviteFlow(
  {
    code,
    signals,
    ua,
    touchPoints = 0,
    doc = document,
    win = window,
    navigate = (url) => location.assign(url),
    record = recordInvite,
    schedule = setTimeout,
    cancel = clearTimeout,
  },
) {
  let cleanup = () => {};
  const store = storeUrl(signals.platform);
  const save = () =>
    Promise.resolve().then(() => record(code, signals)).catch(() => {});
  const boundedSave = () =>
    new Promise((resolve) => {
      const timer = schedule(resolve, 800);
      save().finally(() => {
        cancel(timer);
        resolve();
      });
    });
  return {
    open() {
      cleanup();
      // Start the request before navigating, without losing the tap's user gesture.
      // keepalive lets the request finish while the OS handles the app/intent URL.
      try {
        Promise.resolve(record(code, signals)).catch(() => {});
      } catch { /* best effort */ }
      let departed = false;
      const leave = () => {
        if (doc.visibilityState === "hidden") {
          departed = true;
          cleanup();
        }
      };
      const hide = () => {
        departed = true;
        cleanup();
      };
      const timer = schedule(() => {
        cleanup();
        if (!departed && doc.visibilityState === "visible") navigate(store);
      }, 1600);
      cleanup = () => {
        cancel(timer);
        doc.removeEventListener("visibilitychange", leave);
        win.removeEventListener("pagehide", hide);
      };
      doc.addEventListener("visibilitychange", leave);
      win.addEventListener("pagehide", hide);
      navigate(openUrl(code, ua, touchPoints));
    },
    async install() {
      cleanup();
      await boundedSave();
      navigate(store);
    },
    dispose() {
      cleanup();
    },
  };
}
