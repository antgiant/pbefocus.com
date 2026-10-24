# pbe-storage

Local-first storage with optional OneDrive and Google Drive sync, shared by the pbefocus.com apps. The design is in
`docs/unified-storage-plan.md` (sections 3 and 3.10); this file is the map of the code.

Plain ES modules, no build step, no dependencies. Apps vendor a pinned copy (see "Using it in an app").

```
cookie.js        the cross-app sign-in hint (cookie `pbe_account`, version 2): state transitions, reconcile(), CookieStore
envelope.js      the on-disk JSON envelope, stableStringify, getDeviceId
merge.js         commutative merge helpers (records by id with tombstones, stamped values, set union)
registry.js      ConnectionRegistry: several providers connected at once, kept in step with the cookie
errors.js        StorageError and ErrorKind
auth/            createMicrosoftAuth (MSAL), createGoogleAuth (Google Identity Services)
providers/       onedrive.js, googledrive.js (+ GooglePublicReader), google-picker.js, memory.js (tests), http.js
sync/            engine.js (DocSync: per-device files merged on read), controller.js (debounce, poll, backoff)
test/            node --test "shared/storage/test/*.test.js"   (run `npm test` at the repo root)
```

## Facts the design rests on (Phase 0 tests, 2026-10-23)

- **OneDrive** (`Files.ReadWrite.All`): sharing a folder works. Everyone lists everyone's files; join by sharing link.
- **Google Drive** (`drive.file`): single-user only. An app sees only files its own account created or picked one by one, so a shared
  folder shows nothing to the other person, and the owner cannot change sharing once others have written into it.
- Hence: shared multi-writer spaces are hosted on OneDrive; Google is a person's own storage, or read-only distribution by link.

## How a synced document works

Each device writes ONLY its own file `<doc>.<deviceId>.json` and merges everyone else's on every sync (`DocSync.sync`). There are no write
conflicts, which matters because Google Drive has no conditional write. A device always uploads its full merged state, so any lost or
overwritten file is rebuilt by the next sync. `merge(a, b)` must be commutative, associative and idempotent: use `merge.js`.

## Using it in an app

1. Create a `CookieStore` (`domain: ".pbefocus.com"` in production, none on localhost) and a `ConnectionRegistry` with the providers the app offers.
2. Call `registry.init()` at start-up and `registry.reconcile()` on focus. Sign-in (`registry.connect`) must run from a click.
3. For each synced document create a `DocSync` (provider and folder come from the registry and the person's chosen folder), a `SyncController`
   whose `run` calls `sync`, and `attachBrowserHooks`. Call `controller.request()` after every local change.
4. Keep the app's own local copy as the source of truth for the UI; apply `merged` back when `changed` is true.

Not in this package yet: the account widget (UI), per-app wiring, space invitations and join links.
