# Popcorn Party Android App

A thin native WebView wrapper around the live site
(https://popcornparty.hubbb.workers.dev). Every site update is picked up
automatically — no app update needed.

## Source layout

| Path | Purpose |
|---|---|
| `app/src/main/java/.../MainActivity.kt` | Fullscreen WebView activity |
| `app/src/main/res/` | App icon (mipmap), strings, layout |
| `app/build.gradle` | App config (SDK levels, signing via env vars) |
| `.github/workflows/build-apk.yml` | CI: builds + signs the APK on every push |

## Auto-build (GitHub Actions)

On every push to `main`, the workflow `.github/workflows/build-apk.yml` (at the
repo root) builds a signed release APK and attaches it as a workflow artifact
(visible on the **Actions** tab). Pushing a version tag like `v1.0.0` also
publishes a GitHub Release with the APK.

### Signing (zero-config)

No secrets are required: CI signs with the dev keystore already committed at
`android-app/app/popcornparty.keystore`. For wider distribution, generate your
own keystore and set these optional repository secrets under **Settings →
Secrets and variables → Actions** — the workflow decodes it from
`KEYSTORE_BASE64` and uses `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD`:

```bash
keytool -genkeypair -v -keystore popcornparty.keystore -alias popcornparty \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass popcornparty -keypass popcornparty \
  -dname "CN=Popcorn Party, OU=Dev, O=PopcornParty, L=PH, ST=PH, C=PH"
base64 -w0 popcornparty.keystore   # paste into KEYSTORE_BASE64
```

> Keep the same keystore + alias for all future versions — Android refuses
> upgrades signed with a different key.

## Local build

```bash
cd android-app
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

## Release checklist

1. Bump `versionCode` / `versionName` in `app/build.gradle`
2. Push the change, then tag: `git tag v1.0.1 && git push origin v1.0.1`
3. The APK appears on the GitHub Release page
