# Internal signing keystore (gitignored)

Release APKs are signed with `timebook-debug.keystore` in this folder.

That file is the same Android debug key used for earlier phone installs
(`~/.android/debug.keystore` on the original Mac). It is **not** a Play Store
release key.

## Setup (once per machine)

```bash
bash android/tools/install-local-signing-keystore.sh
```

Or copy manually:

```bash
cp ~/.android/debug.keystore android/keystore/timebook-debug.keystore
```

## Rules

- Do not commit `*.keystore` / `*.jks`.
- Do not delete or recreate the original Mac `~/.android/debug.keystore` if you
  still want over-install updates on existing devices.
- Cloud agents without this file must fail the release build instead of signing
  with a new machine debug key.
