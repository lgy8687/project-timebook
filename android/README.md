# Android offline test build (0.11)

The APK now bundles HTML/JS/CSS/icons and uses AndroidX WebViewAssetLoader.
Tailwind is compiled at build time. No INTERNET permission is requested.
The packaged page has no account or cloud sync. JSON export and import is the only way to move records.
The October demo runs locally with isolated temporary data.

Build requirements: Node.js/npm, Java 17, Gradle 8.11.1, Android SDK 35.
Run `npm ci` in `android/tools`, then `gradle assembleRelease` in `android`.
`prepareWebAssets` regenerates `app/build/generated/webAssets` before each build.
Output: `app/build/outputs/apk/release/app-release.apk`.

The APK uses the existing debug signing key for internal testing, not production.
Website publishing no longer changes this APK; rebuild/install to update it.
Old online-origin data is intentionally not migrated. Local records survive
same-signature upgrades, but uninstalling/clearing app data deletes them.
JSON backup export/import remains available through the Android document picker.

The widget still uses foreground snapshots and a native running chronometer.
This release does not introduce a shared native database/background reconciliation.
Samsung launcher behavior and long-running battery restrictions need device tests.

Acceptance: cold start in airplane mode; record activities/events; force-stop and
reopen; check reports; enter/exit demo; export/import; install an update over the
offline APK. Run shared tests and `tests/android-offline.test.js` before delivery.
