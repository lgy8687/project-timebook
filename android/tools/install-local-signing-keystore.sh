#!/usr/bin/env bash
# Install the original phone-compatible key after checking its trusted fingerprint.
set -euo pipefail
umask 077

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 /path/to/original/debug.keystore EXPECTED_CERT_SHA256" >&2
  echo "Obtain the fingerprint from the known working APK, not the candidate key." >&2
  exit 1
fi
root="$(cd "$(dirname "$0")/.." && pwd)"
src="$1"
expected_sha256="$(printf '%s' "$2" | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
dest="${root}/keystore/timebook-debug.keystore"

if [[ ! "$expected_sha256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Expected certificate SHA-256 must contain 64 hexadecimal digits." >&2
  exit 1
fi
if [[ ! -f "$src" ]]; then
  echo "Source keystore not found: $src" >&2
  exit 1
fi
if [[ -e "$dest" || -L "$dest" ]]; then
  echo "Refusing to overwrite existing keystore: $dest" >&2
  exit 1
fi

mkdir -p "$(dirname "$dest")"
staging="$(mktemp -d "${root}/keystore/.install.XXXXXX")"
trap 'rm -rf "$staging"' EXIT
# Check the staged copy so the bytes installed are the bytes validated.
cp "$src" "$staging/key"
keytool -exportcert -keystore "$staging/key" -storepass android \
  -alias androiddebugkey -file "$staging/certificate.der" >/dev/null
actual_sha256="$(openssl dgst -sha256 "$staging/certificate.der" | awk '{print $NF}')"
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  echo "Certificate SHA-256 mismatch; keystore was not installed." >&2
  exit 1
fi
chmod 600 "$staging/key"
# A hard link publishes atomically and fails if another installer created dest.
ln "$staging/key" "$dest"
echo "Installed $dest (certificate SHA-256: $actual_sha256)"
echo "Keep this file off public GitHub. Rebuild from android with: gradle assembleRelease"
