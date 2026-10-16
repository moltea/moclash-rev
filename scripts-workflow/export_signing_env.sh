#!/usr/bin/env bash
set -euo pipefail

# Export only the signing secrets that are actually set to $GITHUB_ENV.
# Tauri fails on empty APPLE_* values and on updater artifacts without a
# private key, so forks without these secrets build unsigned instead.
#
# Reads: TAURI_PRIVATE_KEY, TAURI_KEY_PASSWORD, APPLE_* from the step env.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export_env() {
	printf '%s<<__SIGNING_EOF__\n%s\n__SIGNING_EOF__\n' "$1" "$2" >> "$GITHUB_ENV"
}

if [ -n "${TAURI_PRIVATE_KEY:-}" ]; then
	export_env TAURI_SIGNING_PRIVATE_KEY "$TAURI_PRIVATE_KEY"
	# An unset password makes the signer prompt interactively; empty means no password.
	export_env TAURI_SIGNING_PRIVATE_KEY_PASSWORD "${TAURI_KEY_PASSWORD:-}"
else
	echo "::warning::TAURI_PRIVATE_KEY is not set, building without updater artifacts"
	node -e '
		const fs = require("fs")
		const file = process.argv[1]
		const conf = JSON.parse(fs.readFileSync(file, "utf8"))
		conf.bundle.createUpdaterArtifacts = false
		fs.writeFileSync(file, JSON.stringify(conf, null, 2) + "\n")
	' src-tauri/tauri.conf.json
fi

for name in APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
	if [ -n "${!name:-}" ]; then
		export_env "$name" "${!name}"
	fi
done
