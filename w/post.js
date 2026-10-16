import { devicePlatform, externalBrowserUrl, storeUrl } from "../c/challenge-api.js";
import {
  getPost,
  isPostId,
  normalizePostId,
  postOpenUrl,
  postSchemeUrl,
  previewLines,
  statsParts,
} from "./post-api.js";
const en = navigator.language.toLowerCase().startsWith("en");
const text = en
  ? {
    brand: "Tadak Tadak", label: "Everyone’s Space", loading: "Loading…",
    gone: "Post not found", missing: "This post was removed or the link is wrong.",
    failed: "Couldn’t load the post. Please try again later.",
    open: "Type this in the app", install: "Install app",
    kakaoHint: "The app may not open inside KakaoTalk. Try another browser.",
    external: "Open in another browser",
    likes: (n) => `${n} likes`, imports: (n) => `${n} imports`,
    practice: (n) => `${n} typed it`,
  }
  : {
    brand: "타닥타닥", label: "모두의 공간", loading: "글을 불러오는 중이에요…",
    gone: "글을 찾을 수 없어요", missing: "삭제되었거나 주소가 올바르지 않아요.",
    failed: "글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    open: "앱에서 이 글 치기", install: "앱 설치하기",
    kakaoHint: "카카오톡 안에서는 앱이 바로 열리지 않을 수 있어요. 다른 브라우저로 열어 주세요.",
    external: "다른 브라우저로 열기",
    likes: (n) => `좋아요 ${n}`, imports: (n) => `가져감 ${n}`,
    practice: (n) => `${n}명이 쳤어요`,
  };
const el = (id) => document.getElementById(id);
document.documentElement.lang = en ? "en" : "ko";
document.title = `${text.brand} · ${text.label}`;
el("brand").textContent = text.brand;
el("label").textContent = text.label;
el("status").textContent = text.loading;
el("open").textContent = text.open;
el("install").textContent = text.install;
el("external").textContent = text.external;
const id = normalizePostId(new URL(location.href).searchParams.get("id"));
const platform = devicePlatform(navigator.userAgent, navigator.maxTouchPoints);
el("install").href = storeUrl(platform);
const fail = (message) => {
  el("title").textContent = text.gone;
  el("status").textContent = message;
  el("open").hidden = true;
  document.body.classList.add("is-gone");
};
if (!isPostId(id)) fail(text.missing);
else {
  el("open").href = postSchemeUrl(id);
  let timer;
  el("open").addEventListener("click", (event) => {
    event.preventDefault();
    clearTimeout(timer);
    const leave = () => {
      if (document.visibilityState === "hidden") clearTimeout(timer);
    };
    document.addEventListener("visibilitychange", leave, { once: true });
    timer = setTimeout(() => {
      if (document.visibilityState === "visible") {
        location.assign(storeUrl(platform));
      }
    }, 1600);
    location.assign(postOpenUrl(id, navigator.userAgent, navigator.maxTouchPoints));
  });
  if (/KAKAOTALK/i.test(navigator.userAgent)) {
    el("kakao-hint").querySelector("p").textContent = text.kakaoHint;
    el("kakao-hint").hidden = false;
    el("external").addEventListener("click", (event) => {
      event.preventDefault();
      location.assign(externalBrowserUrl(location.href));
    });
  }
  try {
    const post = await getPost(id);
    if (!post) fail(text.missing);
    else {
      el("status").textContent = "";
      el("title").textContent = post.title;
      document.title = `${post.title} · ${text.label}`;
      el("author").textContent = [post.author, post.artist].filter(Boolean).join(" · ");
      const { lines } = previewLines(post.content);
      el("content").textContent = lines.join("\n");
      el("stats").textContent = statsParts(post, text).join(" · ");
      el("stats").hidden = !el("stats").textContent;
      el("post").hidden = false;
      el("open").hidden = false;
    }
  } catch (error) {
    el("status").textContent = text.failed;
  }
}
