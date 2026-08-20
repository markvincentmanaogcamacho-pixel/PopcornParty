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

On every push to `main`, the workflow `.github/workflows/build-apk.yml` builds a
signed release APK and attaches it as a workflow artifact (visible on the
**Actions** tab). Pushing a version tag like `v1.0.0` also publishes a GitHub
Release with the APK.

### Required repository secrets

Set these under **PopcornParty → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | `base64 -w0 popcornparty.keystore` — the signing keystore |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | `popcornparty` |
| `KEY_PASSWORD` | Key password |

Create the keystore (or use the generated one) with:

```bash
keytool -genkeypair -v -keystore popcornparty.keystore -alias popcornparty \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass popcornparty -keypass popcornparty \
  -dname "CN=Popcorn Party, OU=Dev, O=PopcornParty, L=PH, ST=PH, C=PH"
```

> The dev keystore used for local builds is intentionally **not committed**.
> CI decodes the real keystore from `KEYSTORE_BASE64`, so the private signing
> material never enters the repository. Keep the same keystore + alias for all
> future versions or Android will refuse upgrades.

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
