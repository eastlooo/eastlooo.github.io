# 타닥타닥 GitHub Pages

Buildless static site for https://eastlooo.github.io. No trackers, cookies, or remote fonts.

1. In `c/challenge-api.js`, replace `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__` with the project URL and public anon/publishable key. Never use a service-role/secret key.
2. In `.well-known/assetlinks.json`, replace `__PLAY_APP_SIGNING_SHA256__` with the Play Console **app signing** certificate fingerprint (not the upload certificate).
3. Publish this directory as the root of `eastlooo/eastlooo.github.io`; Pages → Deploy from branch → root. Keep `.nojekyll` and verify both `.well-known` URLs return their JSON, not HTML.
4. Enable Associated Domains in Apple Developer for `com.dongcheon.Tadak` and refresh provisioning profiles. Install the app after publishing the association file, then test a link from Messages/Notes and from another app on Android, with both cold and warm starts.
5. Run `deno test --allow-read test/challenge_test.ts` here. The app repository contains the un-applied SQL migration and additional verification instructions.

Safari may keep links tapped on the current site's domain in the browser; opening from Messages/Notes exercises Universal Links. For installation after a click, copy the code and use the app's Practice modes → Enter a challenge code entry. There is no deferred attribution service.
