# Voicebox Mobile — V1 plan

A companion app for the Voicebox desktop. iPhone-first, dictate-anywhere, Captures as the hero. Talks to a paired desktop over Tailscale or LAN with end-to-end encryption.

V1 is entirely local — no cloud, no account. The device key minted during pairing is the root of the user's lifetime encryption identity and gets reused by the cloud phases that follow; see [`docs/plans/CLOUD_ROADMAP.md`](../docs/plans/CLOUD_ROADMAP.md) for the post-mobile arc (backup & sync → private inference → marketplace).

---

## Repo layout

- New `mobile/` at repo root, sibling to `app/`, `backend/`, `tauri/`, `landing/`, `web/`
- Standalone Expo project — not a Bun workspace member (avoids React/Tauri/Bun version drag)
- Type-sharing via OpenAPI: generate `mobile/src/api/types.ts` from backend's `/openapi.json`, commit it, regenerate on demand
- Branch off `main` once 0.5.0 ships → `feat/mobile-app`

## Stack (verified 2026-04-25)

### The SDK 54 vs SDK 55 fork

Expo SDK 55 is the current `latest` (`expo@55.0.17`, React Native 0.83, React 19.2, New Architecture only — Legacy Architecture was dropped in 55). It also ships Expo Router v7, Hermes v1 with bytecode diffing, and `expo-brownfield`. But: **NativeWind v5 is the only NativeWind line that targets SDK 55, and v5 is still pre-release** (`5.0.0-preview.3`, with explicit "not intended for production use" warning in the v5 docs). NativeWind v4 stable (`4.2.3`) is paired with SDK 54.

Two real options:

- **Option A — Ship-fast (recommended for V1):** Expo SDK 54 + NativeWind v4.2.3. Both stable, official pairing, well-documented. Loses SDK 55's bytecode-diff updates and Expo Router v7 sugar but everything works.
- **Option B — Cutting-edge:** Expo SDK 55.0.17 + NativeWind 5.0.0-preview.3. Latest everything, but the NativeWind v5 maintainer explicitly says it's for experimentation. More breakage during dev, brittle CI.

Recommendation: **Option A**. We're trying to ship a companion app, not stress-test pre-release styling layers. We can bump to SDK 55 + NativeWind v5 once both stabilize (Expo targets stable SDK 55 mid-2026).

### Pinned versions (assuming Option A)

| Package | Version | Notes |
| --- | --- | --- |
| `expo` | `~54` (latest 54.x) | New Architecture default since SDK 51 |
| `expo-router` | bundled with SDK | file-based, typed routes |
| `nativewind` | `4.2.3` | Tailwind class parity with `app/` |
| `expo-audio` | `~54` (bundled with SDK) | stable in SDK 54+, replaces `expo-av` recording |
| `@shopify/react-native-skia` | `2.6.2` | live waveform; WaveSurfer is DOM-only |
| `expo-camera` | `~54` (bundled) | QR scan (barcode scanning built in) |
| `expo-secure-store` | `~54` (bundled) | paired device key |
| `react-native-reanimated` | `4.3.0` | rewritten for new arch |
| `react-native-gesture-handler` | `2.31.1` | |
| `zustand` | `5.0.12` | mirrors desktop |
| `@tanstack/react-query` | `5.100.5` | mirrors desktop |

(Versions for `expo-*` packages are managed by `npx expo install`, which picks the patch that matches the SDK — don't pin them by hand.)

### Other stack decisions

- **TypeScript strict**
- Theme tokens copied straight from `app/`'s shadcn theme (`hsl(43 60% 50%)` for the gold accent, dark surfaces match)
- **EAS Build** + **Dev Client** from day one — Skia and SecureStore push us off Expo Go

## Pairing & transport — Tailscale-friendly

1. Desktop: new **Settings → Mobile** with "Pair device" → renders QR + 6-digit fallback
2. QR payload: `voicebox://pair?host=<url>&secret=<b64>&fp=<sha256>`
   - `host` = whatever address the user can reach: LAN IP (`192.168.x.x:17493`), Tailscale 100.x address, or MagicDNS name (`mac.tail-xxxx.ts.net:17493`) — Tailscale Just Works with zero extra code
   - `secret` = one-time pairing token; mobile exchanges it for a long-lived device key on first request
   - `fp` = self-signed cert fingerprint we mint at pair time, pinned on mobile
3. Auth: bearer token + XChaCha20-Poly1305 payload encryption with HKDF per-session keys — E2E layer above HTTP, survives any future cloud relay swap

## Backend additions (desktop, separate PR before mobile work)

- `POST /pair/init` — mint pairing token, return QR payload
- `POST /pair/complete` — exchange token for device-bound long-lived key, persist `paired_devices` row
- `GET/DELETE /devices` — Settings → Mobile lists & revokes paired devices, with `last_seen_at`
- Bearer middleware on `/generate`, `/transcribe`, `/profiles`, `/captures`, `/speak` (loopback callers stay unauthenticated as today; paired-device callers use the bearer)
- `/captures` upload accepts `m4a` (expo-audio's iOS default) in addition to existing formats

## Screens

### First-run

Pair flow: scan QR → confirm desktop name + fingerprint → store creds in SecureStore.

### Tab 1 — Generate

- Profile cards horizontal scroll (top)
- Recent generations list (middle) — tap to play, long-press for version picker / regenerate / share
- Floating generate box (bottom): text input + engine indicator + speak button

### Tab 2 — Voices

- List of profiles (cloned + presets), grouped by engine compatibility
- Tap to inspect: samples (Skia waveform thumbs), language, last used
- **No** profile creation in V1

### Tab 3 — Captures (the hero)

- **Big gold mic button** bottom-front-and-center — same accent as the sponsor CTA
- Tap-to-toggle in V1 (push-to-talk fights iOS gestures, defer)
- Live mic waveform via Skia, amplitude polled at 30 Hz, scrolling buffer
- Transcript text area above the waveform — empty during recording, populated on stop
- State pill at top: `recording → uploading → transcribing → refining → done` (mirrors desktop pill semantics)
- Captures list below: each row has a Skia mini-waveform, tap to expand, scrub, edit transcript inline, "Play as voice profile"
- **Audio preserved + downloadable** — visually obvious in the UI; this is the USP
- Schema/UI built so resumable capture can land later without re-architecting (no "one capture = one continuous take" assumptions baked in)

## Out of scope for V1 (deliberately)

Stories editor · Voice profile creation / sample recording · Effects editor · Personality LLM controls · Streaming transcription (lands with resumable capture in V2) · Settings beyond pairing · Android (pipeline supports it; QA focus iOS first)

## V2+ candidates

- **Resumable capture** — pause/resume that actually appends audio AND transcript (Apple Voice Notes drops the second-half transcript on resume; Voicebox shouldn't)
- **Document mode** — refinement LLM writes/edits a markdown document live as you speak, including dictated edits ("change the second bullet to…")
- **Streaming transcription** — partial transcripts during recording
- **Voice profile creation on mobile** — record samples directly
- **Android**
- **Cloud relay** — once the Voicebox platform exists, the same E2E layer rides over a relay so pairing isn't tied to Tailscale/LAN

## Build/dev workflow

```bash
cd mobile
bun install
bunx expo prebuild           # generate native projects (Skia + SecureStore need it)
bunx expo run:ios            # device on the same Tailnet
eas build --profile development   # distributable Dev Client for TestFlight
```

Bundle ID: `sh.voicebox.mobile` (need to register in App Store Connect).

## Order of attack

1. Backend: pairing endpoints + bearer middleware (desktop PR, can land before mobile)
2. Mobile: Expo scaffold + NativeWind + theme tokens + Pair screen
3. Mobile: Captures tab end-to-end — validates transport, E2E layer, audio upload, waveform, pill states all in one flow
4. Mobile: Generate tab
5. Mobile: Voices tab
6. EAS dev build + TestFlight internal track

## Open questions

1. **iOS only V1?** Default: yes.
2. **NativeWind or hand-rolled styles?** Default: NativeWind — class parity with `app/` is worth the small bundler tax.
3. **Crib patterns from the Spacedrive mobile app first**, or start clean from current Expo docs?
4. **Bundle ID + display name** — confirm `sh.voicebox.mobile` / "Voicebox" before EAS setup.
5. **Pair screen UX** — QR-only, or always offer the 6-digit code as an a11y/fallback?
