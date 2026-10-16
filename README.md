# 타닥타닥 GitHub Pages

Buildless static site for https://eastlooo.github.io. No analytics trackers, cookies, or remote fonts. Invite handoff uses short-lived server-side fingerprint matching.

1. In `c/challenge-api.js`, replace `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__` with the project URL and public anon/publishable key. Never use a service-role/secret key.
2. In `.well-known/assetlinks.json`, replace `__PLAY_APP_SIGNING_SHA256__` with the Play Console **app signing** certificate fingerprint (not the upload certificate).
3. Publish this directory as the root of `eastlooo/eastlooo.github.io`; Pages → Deploy from branch → root. Keep `.nojekyll` and verify both `.well-known` URLs return their JSON, not HTML.
4. Enable Associated Domains in Apple Developer for `com.dongcheon.Tadak` and refresh provisioning profiles. Install the app after publishing the association file, then test a link from Messages/Notes and from another app on Android, with both cold and warm starts.
5. Run `deno test --allow-read test/challenge_test.ts` here. The app repository contains the un-applied SQL migration and additional verification instructions.

Safari may keep links tapped on the current site's domain in the browser; opening from Messages/Notes exercises Universal Links. The open button uses `com.dongcheon.tadak://c?k=CODE`. Android Chrome and KakaoTalk use an Android intent with a Play fallback; iOS uses the custom scheme and a 1600 ms visible-page store fallback. KakaoTalk also offers its external-browser command. Install records the invite before opening the store (at most 800 ms).

Before publishing, paste the app repository's `supabase/migrations/20261016090000_challenge_deferred_invites.sql` after the existing challenge migrations. This change does not apply it to production. The SQL RPCs use the existing public key, with no edge function or new client secret. Verify the gateway overwrites `cf-connecting-ip`/`x-forwarded-for`; callers must not be able to spoof them.

At the first app launch, a single non-blocking claim (3 seconds maximum) matches a salted IP hash, platform, full-screen CSS/point dimensions (either orientation) and IANA timezone within 60 minutes. The newest unclaimed, unexpired challenge wins and is consumed atomically. DPR, language and OS major are bounded auxiliary signals, not match gates. Rows are purged opportunistically after 24 hours, so an idle database can retain them longer. No raw IP is stored. Recording is limited to 20 rows per IP/hour and deduplicated per IP/code for 10 minutes.

This is probabilistic: Private Relay, VPNs or network changes can prevent restoration; people sharing carrier NAT, screen dimensions and timezone can collide. Installation taking over an hour, offline first launch, browser privacy reductions and timezone aliases can also miss. An installed app may still require the explicit open button, depending on browser policies. The quiet code panel remains a manual fallback. Test real iOS/Android devices with cold/warm links, fresh installations and KakaoTalk; store fallback timing alone cannot detect installation reliably.
