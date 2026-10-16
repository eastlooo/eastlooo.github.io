import {
  appSchemeUrl,
  collectSignals,
  createInviteFlow,
  externalBrowserUrl,
  getChallenge,
  isCode,
  normalizeCode,
  storeUrl,
} from "./challenge-api.js";
const en = navigator.language.toLowerCase().startsWith("en");
const text = en
  ? {
    brand: "Tadak Tadak",
    title: "Your friend challenged you",
    loading: "Loading challenge…",
    gone: "Challenge not found",
    unavailable:
      "This challenge has expired or the code is invalid. Ask your friend for a new one.",
    failed: "Couldn’t load the challenge. Please try again later.",
    configuration:
      "Challenges will be available soon. You can copy the code and open it in the app.",
    open: "Play in the app",
    install: "Install app",
    kakaoHint: "The app may not open inside KakaoTalk. Try another browser.",
    external: "Open in another browser",
    codeLabel: "Challenge code",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Select the code above and copy it.",
    instruction:
      "Install and open the app to join your friend. If the invite is not restored, enter this code in Practice modes.",
    kpm: "KPM",
    accuracy: "Accuracy",
    hidden: "Your friend hid their record",
    expiry: (d) => `Available until ${d}`,
  }
  : {
    brand: "타닥타닥",
    title: "친구가 승부를 걸었어요",
    loading: "도전을 불러오는 중이에요…",
    gone: "승부를 찾을 수 없어요",
    unavailable:
      "도전이 만료되었거나 코드가 올바르지 않아요. 새 도전을 보내 달라고 해 보세요.",
    failed: "도전을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    configuration: "웹 도전을 준비 중이에요. 코드를 복사해 앱에서 열어 주세요.",
    open: "앱에서 승부하기",
    install: "앱 설치하기",
    kakaoHint: "카카오톡 안에서는 앱이 바로 열리지 않을 수 있어요. 다른 브라우저로 열어 주세요.",
    external: "다른 브라우저로 열기",
    codeLabel: "도전 코드",
    copy: "복사",
    copied: "복사했어요",
    copyFailed: "위 코드를 선택해 복사해 주세요.",
    instruction:
      "앱을 설치하고 실행하면 친구의 도전으로 연결돼요. 연결되지 않으면 실전 연습에서 이 코드를 입력해 주세요.",
    kpm: "타수",
    accuracy: "정확도",
    hidden: "기록을 숨긴 승부예요",
    expiry: (d) => `${d}까지 도전할 수 있어요`,
  };
const el = (id) => document.getElementById(id);
document.documentElement.lang = en ? "en" : "ko";
document.title = `${text.title} · ${text.brand}`;
for (
  const id of [
    "brand",
    "title",
    "open",
    "install",
    "external",
    "copy",
    "instruction",
  ]
) el(id)?.replaceChildren(document.createTextNode(text[id]));
el("code-label").textContent = text.codeLabel;
el("status").textContent = text.loading;
const code = normalizeCode(new URL(location.href).searchParams.get("k"));
if (!isCode(code)) {
  el("title").textContent = text.gone;
  el("status").textContent = text.unavailable;
}
else {
  el("code").textContent = code;
  el("code-panel").hidden = false;
  const signals = collectSignals();
  const flow = createInviteFlow({
    code,
    signals,
    ua: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints,
  });
  el("open").href = appSchemeUrl(code);
  el("open").hidden = false;
  el("open").addEventListener("click", (event) => {
    event.preventDefault();
    flow.open();
  });
  if (el("install")) {
    el("install").href = storeUrl(signals.platform);
    el("install").hidden = false;
    el("install").addEventListener("click", (event) => {
      event.preventDefault();
      void flow.install();
    });
  }
  if (/KAKAOTALK/i.test(navigator.userAgent) && el("kakao-hint")) {
    el("kakao-hint").querySelector("p").textContent = text.kakaoHint;
    el("kakao-hint").hidden = false;
    if (el("external")) {
      el("external").hidden = false;
      el("external").href = externalBrowserUrl(location.href);
      el("external").addEventListener("click", (event) => {
        event.preventDefault();
        location.assign(externalBrowserUrl(location.href));
      });
    }
  }
  el("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      el("copy").textContent = text.copied;
    } catch {
      el("status").textContent = text.copyFailed;
    }
  });
  try {
    const challenge = await getChallenge(code);
    if (!challenge) {
      el("title").textContent = text.gone;
      el("status").textContent = text.unavailable;
      el("code-panel").hidden = true;
      el("open").hidden = true;
      if (el("install")) el("install").hidden = true;
    } else {
      el("status").textContent = "";
      el("sentence").textContent = challenge.sentence;
      el("record-caption-kpm").textContent = text.kpm;
      el("record-caption-accuracy").textContent = text.accuracy;
      el("record-hidden").textContent = text.hidden;
      el("record-hidden").hidden = challenge.kpm != null;
      if (challenge.kpm != null) {
        el("record-kpm").textContent = String(challenge.kpm);
        el("record-accuracy").textContent = challenge.accuracy.toFixed(1);
      }
      el("expiry").textContent = text.expiry(
        new Date(challenge.expiresAt).toLocaleDateString(en ? "en" : "ko"),
      );
      el("preview").hidden = false;
    }
  } catch (error) {
    el("status").textContent = error.message === "configuration"
      ? text.configuration
      : text.failed;
  }
}
