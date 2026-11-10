# Android offline test build (0.12)

The APK now bundles HTML/JS/CSS/icons and uses AndroidX WebViewAssetLoader.
Tailwind is compiled at build time. No INTERNET permission is requested.
The packaged page has no account or cloud sync. JSON export and import is the only way to move records.
The October example and the page-code inspector are removed from this install.
The packaged page includes the current web changes.

Build requirements: Node.js/npm, Java 17, Gradle 8.11.1, Android SDK 35.
Before the first release build on a machine, install the phone-compatible debug
keystore (do not commit it):

```bash
bash android/tools/install-local-signing-keystore.sh
```

That copies `~/.android/debug.keystore` to `android/keystore/timebook-debug.keystore`.
Release signing no longer uses the build machine's default debug key, so a cloud
rebuild cannot silently create an uninstallable update.

Then run `npm ci` in `android/tools`, then `gradle assembleRelease` in `android`.
`prepareWebAssets` regenerates `app/build/generated/webAssets` before each build.
Output: `app/build/outputs/apk/release/app-release.apk`.

The APK uses that project-local debug key for internal testing, not production.
Website publishing no longer changes this APK; rebuild/install to update it.
Old online-origin data is intentionally not migrated. Local records survive
same-signature upgrades, but uninstalling/clearing app data deletes them.
JSON backup export/import remains available through the Android document picker.

The widget still uses foreground snapshots and a native running chronometer.
This release does not introduce a shared native database/background reconciliation.
Samsung launcher behavior and long-running battery restrictions need device tests.

Acceptance: cold start in airplane mode; record activities/events; force-stop and
reopen; check reports; export/import; install an update over the
offline APK. The install has no October example and no page-code button.
Run shared tests and `tests/android-offline.test.js` before delivery.
