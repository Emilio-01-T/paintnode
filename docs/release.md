# PaintNode Release Notes

PaintNode uses GitHub Releases as the Tauri updater backend.

## Required Repository Secrets

Shared by macOS and Linux updater builds:

- `TAURI_SIGNING_PRIVATE_KEY`: full contents of the Tauri updater private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: password for the Tauri updater private key

Generate a repository-owned updater key before the first release and replace the
public key in `src-tauri/tauri.conf.json`. Keep an offline backup of the private
key and password: GitHub secrets cannot be read back, and losing this key prevents
future releases from updating installations that trust it.

macOS signing and notarization only (optional; without the complete set the
workflow publishes an unsigned build):

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`
- `APPLE_SIGNING_IDENTITY`: your own `Developer ID Application` identity
- `APPLE_API_ISSUER`: App Store Connect issuer UUID
- `APPLE_API_KEY`: App Store Connect key ID
- `APPLE_API_KEY_P8`: full contents of the downloaded `AuthKey_*.p8`

## Release Artifacts

- macOS arm64/x64: `.app` and `.dmg` bundles, signed/notarized when Apple secrets are configured
- Linux x86_64: `.deb` installer and AppImage
- Tauri updater: signed metadata in `latest.json`; Linux `.deb` and AppImage
  installations each receive their matching package format

Linux release builds run on Ubuntu 22.04, the oldest supported CI baseline, to
avoid linking against a newer glibc than supported Ubuntu/Debian installations.
The `.deb` automatically installs the `PaintNode.desktop` launcher and application
icons under the system hicolor icon theme.

## Release Flow

1. Update versions in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Add release notes at `docs/release-notes/<version>.md`.
3. Run `npm run check`, `npm run verify:release-config`, `npm test`, and
   `cargo check --locked --manifest-path src-tauri/Cargo.toml`.
4. On Linux, run `npm run tauri:build:linux` and `npm run verify:linux:deb`.
5. Before the first Linux app release (and whenever provider versions change), run
   the **Provider runtimes** workflow for `provider-runtimes-latest`, enable the
   explicit production confirmation, and verify that both Codex and Claude list a
   `linux-x64` artifact in `runtime-manifest.json`. The app release workflow checks
   every published macOS/Linux runtime target and stops before publishing if one is
   missing or incompatible.
6. Commit the release.
7. Push a tag such as `paintnode-v0.1.1`.
8. GitHub Actions builds each target serially into a draft release, validates that
   `latest.json` contains Linux x86_64 AppImage and `.deb` entries plus both macOS
   architectures, then publishes `PaintNode v0.1.1` atomically with all app bundles
   and updater artifacts.

The release notes file becomes both the GitHub release body and the notes shown in
the in-app updater dialog. The workflow fails if the file is missing so placeholder
text does not ship to users.

The app checks:

```text
https://github.com/Emilio-01-T/paintnode/releases/latest/download/latest.json
```
