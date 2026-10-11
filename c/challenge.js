import {normalizeCode, isCode, appUrl, getChallenge} from './challenge-api.js';
const en = navigator.language.toLowerCase().startsWith('en');
const text = en ? {
  brand:'Tadak Tadak',title:'A sentence from a friend',loading:'Loading challenge…',unavailable:'This challenge has expired or the code is invalid. Ask your friend for a new one.',failed:'Couldn’t load the challenge. Please try again later.',configuration:'Challenges will be available soon. You can copy the code and open it in the app.',open:'Open in app',codeLabel:'Challenge code',copy:'Copy',copied:'Copied',copyFailed:'Select the code above and copy it.',instruction:'After installing, open Practice modes and tap “Enter a challenge code”.',record:(k,a)=>`Friend: ${k} KPM · ${a.toFixed(1)}% accuracy`,hidden:'Record hidden',expiry:d=>`Available until ${d}`,
} : {
  brand:'타닥타닥',title:'친구가 보낸 문장',loading:'도전을 불러오는 중이에요…',unavailable:'도전이 만료되었거나 코드가 올바르지 않아요. 새 도전을 보내 달라고 해 보세요.',failed:'도전을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',configuration:'웹 도전을 준비 중이에요. 코드를 복사해 앱에서 열어 주세요.',open:'앱에서 열기',codeLabel:'도전 코드',copy:'복사',copied:'복사했어요',copyFailed:'위 코드를 선택해 복사해 주세요.',instruction:'앱을 설치한 뒤 실전 연습에서 ‘도전 코드 입력’을 눌러 주세요.',record:(k,a)=>`친구 기록: ${k}타·정확도 ${a.toFixed(1)}%`,hidden:'기록을 숨긴 도전',expiry:d=>`${d}까지 도전할 수 있어요`,
};
const el = id => document.getElementById(id);
document.documentElement.lang = en ? 'en' : 'ko';
document.title = `${text.title} · ${text.brand}`;
for (const id of ['brand','title','open','copy','instruction']) el(id).textContent = text[id];
el('code-label').textContent = text.codeLabel;
el('status').textContent = text.loading;
const code = normalizeCode(new URL(location.href).searchParams.get('k'));
if (!isCode(code)) el('status').textContent = text.unavailable;
else {
  el('code').textContent = code; el('code-panel').hidden = false;
  el('open').href = appUrl(code); el('open').hidden = false;
  el('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code); el('copy').textContent = text.copied; }
    catch { el('status').textContent = text.copyFailed; }
  });
  try {
    const challenge = await getChallenge(code);
    if (!challenge) { el('status').textContent = text.unavailable; el('open').hidden = true; }
    else {
      el('status').textContent = '';
      el('sentence').textContent = challenge.sentence;
      el('record').textContent = challenge.kpm == null ? text.hidden : text.record(challenge.kpm, challenge.accuracy);
      el('expiry').textContent = text.expiry(new Date(challenge.expiresAt).toLocaleDateString(en ? 'en' : 'ko'));
      el('preview').hidden = false;
    }
  } catch (error) { el('status').textContent = error.message === 'configuration' ? text.configuration : text.failed; }
}
