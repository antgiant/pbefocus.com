# PBE Focus unified storage and sign-in: implementation plan

Status: draft for review. Owner: antgiant. Written 2026-10-22.

## 1. Goal

Every pbefocus.com app (Karaoke, Quiz, Score Keeper, and later others) works with **local storage by default** and offers an
**opt-in upgrade to cloud storage** (Google Drive and Microsoft OneDrive first, other providers later). Signing in or out on one
app signs the person in or out on all of them. All of this runs on **GitHub Pages only**: no Fly server, no other backend.

Rollout order, fixed by the owner:

1. **Phase 1: Karaoke**
2. **Phase 2: Quiz**
3. **Phase 3: Score Keeper**, which is blocked on the separate work of removing its Fly dependency.

## 2. What the code looks like today (verified)

| App | Persistence today | Cloud use today | Notes |
|---|---|---|---|
| Karaoke (`karaoke.pbefocus.com`) | One JSON blob in `localStorage` key `pbe-karaoke:v1` (`assets/js/storage.js`, `loadState`/`saveState`, synchronous). | **Read-only song library** from a OneDrive folder link (MSAL, scope `Files.Read`, `offline/onedrive-library.js`) or a Google Drive link (API key, no sign-in, `offline/googledrive-library.js`). Not used for user data. | Pre-release: `AI_TODO.md` says freely break stored state, no migrations. Uses MSAL popup flow. Reuses StepUp's Azure client ID `1b28096c-...`. No build step; vendored `msal-browser.min.js`. Offline-first (service worker plus Cache Storage). |
| Quiz (`quiz.pbefocus.com`) | `localStorage`: profiles/settings blob (`assets/js/storage.js`) plus per-profile preference keys (`main.js` around line 928). | None. | Live (`live: true` in `site-nav.js`), so **real users have data to preserve**. No build step. |
| Score Keeper (`pbe-scores.wooleys.us`) | Multi-doc Yjs in IndexedDB (`pbe-score-keeper-global`, `pbe-score-keeper-session-{id}`). `.yjs` export/import. | None. Real-time rooms use y-webrtc with signaling and a y-websocket mode on Fly (`wss://y-webrtc-pbe.fly.dev`), plus two dead or unreliable public backups. | **Lives on `wooleys.us`, not `pbefocus.com`.** Classic scripts, a Yjs bundle built with esbuild, i18n in 4 languages, version-bump rule, README states "not shared with any server". |
| Fill-in-the-blank | Not examined. | | Also on `pbe.wooleys.us`. |
| `pbefocus.com` root | Static site; serves shared `site-nav.js` consumed by the other apps. | | Whole repo is deployed to Pages (`path: '.'`), so a `shared/` directory is served for free. |

Existing registrations: the Microsoft client ID in Karaoke is **StepUp's** ("Step Up Helper"), and the Google API key belongs to
a different project. Neither is the right identity for pbefocus.com apps.

Reference implementation: `antgiant/StepUp` already has the pattern this plan generalizes (a `StorageProvider` and `StorageAuth`
abstraction, MSAL with a remembered `loginHint` and a once-only auto sign-in, Google Identity Services (GIS) with `prompt: "none"` and a
hint, an offline outbox). Its code is TypeScript built with Vite, so it is **ported to plain JS with JSDoc**, not imported.

## 3. Target architecture

### 3.1 Identity model

- **One registration per provider, named "PBE Focus"**, shared by every app. Provider consent screens and the OneDrive folder name
  show this brand, never an app name. Google `drive.file` access and OneDrive app-folder access are **per client ID**, so a
  shared client is what lets all apps see the same files.
- **Local-only is a full mode**, not a degraded one. Cloud is a replica; the browser copy is the source of truth for the UI.
- **Sign-in = connecting a storage account.** There is no separate PBE account.

### 3.2 Cross-app sign-in and sign-out (no backend)

Share the **hint, never the tokens**, using a first-party cookie.

- Cookie `pbe_account`, `Domain=.pbefocus.com; Path=/; Secure; SameSite=Lax`, ~1 year, rewritten on each visit (Safari caps
  script-set cookie lifetime).
- Value (base64url JSON): `{ v:1, provider:"google"|"microsoft", hint:"<email>", at:<epoch ms> }`, or a sign-out marker
  `{ v:1, out:<epoch ms> }`. **It contains no credential**; an email is the one personal item and is disclosed in the privacy page.
- **Start-up:** if the cookie names a provider and this app has no session, run that app's own silent sign-in (MSAL
  `acquireTokenSilent`/`ssoSilent` with `loginHint`, or GIS `prompt:"none"` with `hint`). Consent was granted to the shared client, so
  it completes with no prompt. If it needs a click, show a "Reconnect" chip (a click is the user gesture a popup needs).
- **Sign-out:** clear this app's tokens, revoke the Google token, write the sign-out marker. **Local data is kept.** This does
  not sign the person out of Google or Microsoft themselves.
- **Other apps notice** by re-reading the cookie on load, `visibilitychange`/focus, and `cookieStore` change events where supported.
  A sign-out marker newer than this app's own sign-in time signs this app out locally. A new provider cookie triggers silent sign-in.
- **Stale-session guard:** one automatic attempt per page load (as StepUp does with its `sessionStorage` flag), so a failure shows a button, never a loop.
- **Domain requirement:** apps must be on `*.pbefocus.com` (or the apex) to see the cookie. This is why Score Keeper's move off
  `wooleys.us` is part of Phase 3.
- **Provider sessions:** Microsoft SPA refresh tokens last about a day and Google gives browsers no refresh token (about 1 hour
  access tokens). The provider's own session plus the hint covers this; expect an occasional popup, which the Reconnect chip handles.

Considered and rejected: an `accounts.pbefocus.com` iframe hub or token broker. It adds an origin, `postMessage` plumbing and a
token-exposure surface for little gain now that the hint approach works. Revisit only if the per-origin redirect/origin lists
become a burden (see 3.6).

### 3.3 Where the shared code lives

- **Canonical source:** `pbefocus.com/shared/storage/` as plain ES modules with JSDoc types and unit tests (`node --test`).
- **Distribution: vendored, pinned copies in each app** (`assets/vendor/pbe-storage/`, with a `VERSION` and a hash), updated by a
  small script. Reasons: Karaoke is offline-first and its service worker caches only its own origin; the apps' conventions already
  vendor MSAL rather than load third-party code at runtime; a compromise or bad deploy of the root site cannot silently change other apps.
- **Score Keeper** uses classic scripts, so the same source is also built to an **IIFE bundle** with esbuild (already a dev
  tool there). The bundle is committed under `shared/dist/`.
- `site-nav.js` is the existing precedent for sharing from the root, but it is presentation only and may stay runtime-loaded.

### 3.4 Module shape

```
pbe-storage/
  auth/        cookie.js (protocol 3.2), microsoft.js (MSAL wrapper), google.js (GIS wrapper), session.js
  providers/   local.js (IndexedDB/localStorage), onedrive.js, googledrive.js, memory.js (tests)
  sync/        engine.js (queue, debounce, retry), merge.js (helpers), envelope.js
  ui/          account-widget.js (connect, status, reconnect, sign out, sync now), strings.js (i18n hook)
```

Provider interface (small; a subset of StepUp's, no folder browsing): `ensureRoot()`, `list(ns)`, `read(ns, name)`,
`write(ns, name, bytes)`, `remove(ns, name)`, `status()`, plus `auth` (`restore`, `signIn`, `signOut`, `canAutoSignIn`, `autoSignIn`, `getToken`).

### 3.5 Cloud layout and sync algorithm

```
PBE Focus/                      (OneDrive: /Apps/PBE Focus/, created by the client; Google: a "PBE Focus" folder created by the client)
  _pbe.json                     format version, created-by
  karaoke/    state.<deviceId>.json, history.<deviceId>.json
  quiz/       profiles.<deviceId>.json
  scorekeeper/<sessionId>.<deviceId>.yjs, index.<deviceId>.json
  shared/     reserved for cross-app data
```

- **Per-device files, merged on read.** Each device writes only its own files and reads all of them. This avoids write
  conflicts entirely, which matters because **Google Drive has no conditional write** (StepUp's Google provider can only compare
  `version` just before writing) and OneDrive ETags do not help when two devices race.
- **Opaque transport, app-defined merge.** The sync engine moves bytes and ETags; each app supplies `merge(localBytes, remoteBytes)`.
  - Karaoke/Quiz: JSON envelope `{ format:"pbe-doc", app, kind, schema, deviceId, updatedAt, data }`. Records carry stable ids and
    `updatedAt`; merge by id, last-writer-wins per record, **tombstones for deletes**, set-union for append-only history.
  - Score Keeper: native Yjs binary; merge is `Y.applyUpdate`, which is conflict-free.
- **Compaction:** a device may fold other devices' files into its own after N days and delete the originals it has verified merged.
- **Local-first loop:** write local immediately, debounce upload, retry with backoff, keep an outbox in IndexedDB, upload when
  reachable. Poll remote on focus and every few minutes (no push channel on Pages).
- **Scopes:** Google `drive.file` (non-sensitive; no verification review). A visible `PBE Focus` folder is chosen over the hidden `appdata`
  folder so people can see, back up and later share it. Microsoft `Files.ReadWrite.AppFolder` plus `offline_access`, `User.Read`.
  Feature scopes are requested **incrementally** (Karaoke's library reading keeps `Files.Read` as a separate, later request).
- **Sharing with other people** (the Google Picker path) is **out of scope for the first three phases**; apps share data with each
  other through the shared client. Add it later (see section 7).

### 3.6 Registrations and naming (Phase 0 deliverables)

- **Google Cloud:** project `pbefocus`; consent screen **published ("In production", not Testing)** with app name "PBE Focus",
  authorized domain `pbefocus.com`, privacy and terms URLs on `pbefocus.com`; OAuth client "PBE Focus Web" (Web application);
  authorized JavaScript origins: `https://karaoke.pbefocus.com`, `https://quiz.pbefocus.com`, `https://pbefocus.com` (only if an
  app is served there), later `https://scores.pbefocus.com` (name TBD), plus `http://localhost:<port>` for dev. No client secret is used.
- **Microsoft Entra:** app "PBE Focus"; accounts in any organizational directory **and personal Microsoft accounts**; platform
  **Single-page application**; one exact redirect URI per app origin (plus localhost); publisher domain verified.
- **Dev:** separate "PBE Focus (Dev)" registrations restricted to `localhost`.
- Each new app adds its origin to both consoles (no wildcards). This is the accepted cost of having no hub.
- `pbefocus.com` hosts `privacy.html` and `terms.html` covering all apps, and states plainly what is stored where.

### 3.7 Security notes (static hosting)

- Tokens live in the app's own `localStorage`/`sessionStorage` (as StepUp does); scopes are minimal to cap the blast radius.
- No third-party scripts in the apps; vendored libraries only. Add a CSP `<meta>` where it does not break the app (Pages cannot send headers).
- The cookie is a hint; an attacker who sets it can at most trigger a sign-in attempt for that account; consent still happens at the provider.
- **Dangling-CNAME takeover:** any retired `*.pbefocus.com` subdomain can read the cookie and has an authorized-origin slot. Remove
  DNS and console entries together; verify the domain in GitHub Pages settings.
- Do not enable cloud features when an app is **embedded** in a third-party page (Score Keeper embedding mode).

## 4. Phase 0: foundations (before Phase 1 ships)

1. Create the Google and Microsoft "PBE Focus" registrations (3.6). Publish the Google consent screen.
2. Add `privacy.html`, `terms.html` to `pbefocus.com`, covering local vs cloud storage and the cookie.
3. Create `shared/storage/` in `pbefocus.com` with: cookie protocol, provider interface, memory provider, envelope and merge
   helpers, sync engine, tests (`node --test`, fake `document.cookie`, fake provider). Port from StepUp rather than rewrite:
   `googleAuth.ts`, `auth.ts`, `storage/google.ts`, `storage/onedrive.ts` (reduced to the interface in 3.4).
4. Vendoring script (`scripts/vendor-shared.mjs`) that copies a pinned build into an app and records version and hash.
5. **Two-account test of Google `drive.file` behavior** with the shared client: a folder created by app A is visible to app B on
   the same account (expected yes); a folder created by account X is not visible to account Y until picked (expected yes); the
   Picker's effect on a folder's contents (StepUp's own to-do suggests a picked folder can look empty). Record the results here;
   they decide whether cross-person sharing is feasible later.
6. Decide and record the subdomain for Score Keeper (3.2 domain requirement) and Fill-in-the-blank.

Exit: a demo page on `localhost` signs in with both providers, writes and reads a test file in `PBE Focus/`, and signs out in a
second tab via the cookie.

## 5. Phase 1: Karaoke

Karaoke is the reference migration. Its user state is small and the app is pre-release, so shape changes are free.

### 5.1 Scope of data

| Data | Behavior |
|---|---|
| Playlists (id, name, selection, genre mix, takes) | Synced. Per-record `updatedAt`, tombstones. |
| History (`sectionKey` -> attempts) | Synced. Union by attempt id (add ids if `history.js` attempts lack them). |
| `karaokeControls`, `karaokeTextScale` | Synced, last-writer-wins per key. |
| `activePlaylistId` | Per-device (not synced). |
| `manifestUrl` (library link, can grant access to the whole private library) | **Device-local by default.** Never uploaded without an explicit choice. |
| Audio and manifest caches | Never synced. |

### 5.2 Work items

1. **Vendor `pbe-storage`** into `assets/vendor/`. Vendor the existing MSAL copy only once (shared with the library code).
2. **Refactor persistence behind a repository** keeping the current synchronous `loadState`/`saveState` API for callers:
   - Local layer stays `localStorage` (fast, sync). A background sync engine reads and writes through it.
   - `saveState` stamps changed records with `updatedAt` and enqueues an upload.
   - On a remote merge, apply to local, dispatch a `pbe:state-changed` event, and re-render affected panels (playlists, history).
3. **Replace the library's MSAL instance and client ID** (`onedrive-library.js`) with the shared auth module and the PBE Focus
   client. Keep `Files.Read` as an incremental scope for library link reading. Keep the popup flow (Karaoke is mid-playback; a redirect would interrupt audio) with a redirect fallback when popups are blocked.
4. **Google sign-in** for storage via GIS (new for Karaoke). The existing API-key library access is unchanged and stays sign-in-free.
5. **Account widget** in the header beside the shared site nav: Local only / Connected as X / Reconnect / Sign out / Sync now / last synced.
   First-run offers "Keep local (default)" or "Back up to Google Drive / OneDrive". No sign-in prompt appears unasked.
6. **Cross-app cookie behavior** (3.2) wired in at startup.
7. **Service worker:** exclude `*.googleapis.com`, `graph.microsoft.com`, `login.microsoftonline.com` from any caching; bump `SHELL_CACHE`.
8. **Docs/privacy:** update README and `AGENTS.md` (storage model, registration names, vendoring), and the in-app privacy wording.
9. **Tests** (`npm test`): merge rules (playlist conflict, delete vs edit, history union), sync engine against the memory provider
   (offline outbox, retry, concurrent devices), cookie protocol, repository keeps the sync API contract. Existing UI tests still pass.
10. **Manual QA matrix (section 8).**

### 5.3 Exit criteria

- Local-only behavior is unchanged for someone who never connects.
- Two browsers on one Google account converge on playlists and history; the same for OneDrive.
- Sign-out in one browser signs out the other on focus; sign-in on one is picked up by the other.
- Karaoke's `onedrive-library.js` no longer references StepUp's client ID.
- `AI_TODO.md` / `AGENTS.md` updated; `site-nav.js` `live` flag for karaoke handled separately at go-live.

## 6. Phase 2: Quiz

Quiz has real users, so **data must survive**.

1. Vendor `pbe-storage`; add the Microsoft/Google wrappers (Quiz has no sign-in code today, so MSAL is vendored here too).
2. **Data mapping:** profiles (already have `crypto.randomUUID()` ids, so they merge naturally), per-profile `settings` and
   `selectedScope` (last-writer-wins per profile), and the per-profile preference keys in `main.js`. `selectedPrintPeopleIds` and
   `activeProfileId` are per-device.
3. **One-time local-to-cloud rule:** first connect with local data and an empty cloud uploads local. First connect with data on
   both sides merges (union of profiles by id; ties go to the newer `updatedAt`); never replaces. Show a summary and a one-click
   "download a backup first" (the app's existing export).
4. Privacy: profiles contain people's names (possibly children's). State clearly that they go only to the person's own cloud account.
5. Account widget, cookie protocol, service worker exclusions, tests, README/AGENTS updates, as in Phase 1.
6. Add `quiz` origin to both registrations (Phase 0 may already have done so).

Exit: existing Quiz users see no change until they opt in; opting in on one device and then on a second shows the same profiles; Karaoke and Quiz share a sign-in.

## 7. Phase 3: Score Keeper

### 7.0 Prerequisite A: remove the Fly dependency (separate workstream, blocks 7.2 onward)

I could **not find a written plan for this in the repo** (no mention in `AGENTS.md`, `TECH.md`, README, or docs). This plan therefore
treats it as an input and lists what it must deliver. Please point me to the planned design or confirm one of the options below.

- Today: `wss://y-webrtc-pbe.fly.dev` is the primary signaling server and also provides a **y-websocket mode for 30+ person events**
  (`/ws/*`, encrypted client-side). The two backups are an official demo server and a Heroku app whose free tier no longer exists.
- Deliverable: no `fly.dev`, `herokuapp.com`, or other server dependency in `scripts/app-sync.js`, `AGENTS.md`, README, tests,
  or `server/`; room join/leave, passwords and the username-collision logic keep working; the README "Real-Time Sync Note"
  and `AGENTS.md` signaling section are rewritten.
- Candidate approaches: serverless signaling over public relays (Trystero-style strategies); manual/QR signaling for small rooms;
  using cloud-file sync for "my own devices" so live rooms are only for multi-person events; dropping the 30+ websocket mode
  (and saying so). **The large-event mode has no serverless equivalent and is the main product decision.**

### 7.1 Prerequisite B: move to `*.pbefocus.com`

The cookie and the provider origin lists need the app on `pbefocus.com`. IndexedDB, service workers and installed PWAs are per
origin, so **moving the origin strands local data**.

- Choose the subdomain (Phase 0 item 6) and add it to both registrations and `site-nav.js`.
- **Data handoff:** the old origin gets a final release with a "Move to the new address" page that exports every session as native
  `.yjs` (`exportAllSessions`) and hands it to the new origin (popup plus `postMessage` with an origin allowlist, falling back to
  the existing Export/Import). The new origin imports with `importSessionData`. Keep the old site serving read-only plus the redirect for a long period.
- Update the `web+pbe://` handlers, `manifest` `start_url`/scope, the embedding docs (hosted embedding URL), and the README language links.

### 7.2 Cloud storage

1. Build `pbe-storage` as an IIFE bundle and add it to `index.html` script order (after `app-i18n.js`, before `app.js`), per the repo rule.
2. **Per-session sync:** after each local update, write the session doc's update as `scorekeeper/<sessionId>.<deviceId>.yjs`;
   remote files are `Y.applyUpdate`d into the open session doc. The global doc (session list, names, order) syncs through `index.<deviceId>.json` with the soft-delete pattern the app already uses.
   DocManager gets a cloud-replica hook next to IndexedDB persistence; **no change to the CRDT data model**.
3. A live room and a cloud replica can feed the same Y.Doc safely (both are CRDT updates). Keep "one room = one session".
4. History attribution (`user` field) is unchanged; cloud sync adds no new attribution.
5. Embedding mode (`EMBEDDING_*`) disables cloud features.
6. i18n: every new string through `t()` in `en.js` first, then `es.js`, `fr.js`, `pig.js`; rewrite the README "Data Storage Note" in all four READMEs; run `node --test tests/unit/i18n.test.js`.
7. Versioning (MINOR bump, `index.html` footer), update `CLAUDE.md`/`AGENTS.md` test counts and architecture sections, run the full `node --test`.
8. New tests: unit tests for the Yjs merge path and session-id/file mapping; UI tests for the account widget and the sign-in/out flows (fake provider).

Exit: a session edited on two devices converges; sign-in is shared with Karaoke/Quiz; migrating from the old origin loses nothing.

## 8. Test matrix (every phase)

- Browsers: Chrome, Firefox, Safari (macOS and iOS), installed PWA where it exists.
- Providers: Google personal, Microsoft personal, (once) a Microsoft work account.
- Scenarios: first connect; two devices, concurrent edits; offline edits then reconnect; token expiry and the Reconnect chip;
  revoking the app in the provider's account settings; sign-out in one app while another is open; clearing cookies;
  third-party-cookie blocking; popup blocked; private browsing (storage unavailable); two Google accounts (switching accounts).
- Release checks: no tokens in logs or exports; the cookie holds no credential; service workers never cache provider traffic.

## 9. Risks and open questions

| Item | Risk / question | Plan |
|---|---|---|
| Google consent screen status | "Testing" status limits users and shortens token lifetime. | Publish to production in Phase 0 (scopes are non-sensitive). |
| Google refresh limits | Hourly re-auth; silent renewal can fail when third-party cookies are blocked. | Lazy renewal, Reconnect chip, never block the app on cloud state. |
| Microsoft refresh limits | About daily re-login. | Same pattern as StepUp (hint plus one auto attempt). |
| Per-origin lists | Each new app edits two consoles. | Accept; revisit a hub only if painful. |
| Google Picker / cross-person sharing | Behavior of a picked folder's contents unverified. | Phase 0 two-account test; defer sharing. |
| Fly replacement | Not documented in the repo; large-event mode has no easy substitute. | Section 7.0; needs owner decision. |
| Score Keeper origin move | Local data and PWA installs are per origin. | Section 7.1 handoff plus long-lived old site. |
| Cookie email | Email in a first-party cookie. | Disclose; contains no credential; user can clear it by signing out. |
| Pre-release Karaoke | Easy to change shape now, hard later. | Land the record/`updatedAt` shape in Phase 1. |
| Karaoke library link | A synced `manifestUrl` could widen access. | Device-local by default. |

Questions still open: what exactly is the planned Fly-removal design for Score Keeper; the target subdomain names for Score Keeper
and Fill-in-the-blank; whether Fill-in-the-blank is in scope; whether cross-person sharing (Picker) is wanted in a later phase.
