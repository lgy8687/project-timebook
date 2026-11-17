# Internal signing keystore (gitignored)

Release APKs are signed with `timebook-debug.keystore` in this folder.

That file is the same Android debug key used for earlier phone installs
(`~/.android/debug.keystore` on the original Mac). It is **not** a Play Store
release key.

## Setup (once per machine)

Use the original Mac `~/.android/debug.keystore`, transferred privately if needed.
A different machine's default debug key cannot update the existing phone install.
Java `keytool` and OpenSSL are required.

Read the trusted certificate SHA-256 from the APK that already installs correctly:

```bash
apksigner verify --print-certs /path/to/known-working.apk
```

Use the **signer certificate SHA-256 digest**, not the APK file hash. Run from the
repository root, replacing the path and fingerprint:

```bash
bash android/tools/install-local-signing-keystore.sh /path/to/original/debug.keystore EXPECTED_CERT_SHA256
```

The fingerprint accepts hexadecimal digits with optional colons. Do not obtain
it from an unverified candidate key; that would defeat the compatibility check.
The installer validates a staged copy and publishes it without overwriting an
existing file. If a key is already installed, preserve it. To replace a known wrong
key, move it aside manually only after confirming the correct fingerprint.

## Rules

- Do not commit `*.keystore` / `*.jks`.
- Do not delete or recreate the original Mac `~/.android/debug.keystore` if you
  still want over-install updates on existing devices.
- Cloud agents without this file must fail the release build instead of signing
  with a new machine debug key.

