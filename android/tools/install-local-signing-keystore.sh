#!/usr/bin/env bash
# Copy the machine debug keystore into the project-local path used by release builds.
# Default source matches the existing phone installs (Android Studio debug key).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="${1:-${HOME}/.android/debug.keystore}"
dest="${root}/keystore/timebook-debug.keystore"

if [[ ! -f "${src}" ]]; then
  echo "Source keystore not found: ${src}" >&2
  echo "Pass an explicit path if your debug.keystore lives elsewhere." >&2
  exit 1
fi

mkdir -p "$(dirname "${dest}")"
cp "${src}" "${dest}"
chmod 600 "${dest}"
echo "Installed ${dest}"
echo "Keep this file off public GitHub. Rebuild with: gradle assembleRelease"
