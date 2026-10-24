import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleAuth } from "../auth/google.js";
import { createMicrosoftAuth } from "../auth/microsoft.js";
import { ErrorKind, StorageError } from "../errors.js";
import { pickFiles, pickFolder } from "../providers/google-picker.js";
import { fakeFetch } from "./helpers.js";

// ---- Google ---------------------------------------------------------------------------------------------------

function fakeGoogle({ failSilent = false } = {}) {
  const requests = [];
  const revoked = [];
  return {
    requests,
    revoked,
    accounts: {
      oauth2: {
        initTokenClient: ({ callback, error_callback }) => ({
          requestAccessToken: (opts) => {
            requests.push(opts);
            if (opts.prompt === "none" && failSilent) return error_callback({ type: "popup_failed_to_open", message: "needs interaction" });
            callback({ access_token: `tok${requests.length}`, expires_in: 3600 });
          },
        }),
        revoke: (token, done) => { revoked.push(token); done(); },
      },
    },
  };
}
const storage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const about = fakeFetch([{ match: "/drive/v3/about", reply: { json: { user: { emailAddress: "me@gmail.com" } } } }]);
const googleAuth = (extra = {}) => createGoogleAuth({ clientId: "cid", fetch: about, storage: storage(), ...extra });

test("Google: first sign-in asks the person to pick an account and reports who signed in", async () => {
  const google = fakeGoogle();
  const auth = googleAuth({ google });
  await auth.signIn();
  assert.deepEqual(google.requests[0], { prompt: "select_account" });
  assert.equal(await auth.getToken(), "tok1");
  assert.deepEqual(await auth.restore(), { id: "me@gmail.com", name: "me@gmail.com" });
});

test("Google: the next sign-in reuses the remembered account without a picker", async () => {
  const google = fakeGoogle();
  const auth = googleAuth({ google });
  await auth.signIn();
  await auth.signIn();
  assert.deepEqual(google.requests[1], { prompt: "", hint: "me@gmail.com" });
});

test("Google: an expired token is renewed quietly with the hint; failure is an auth error", async () => {
  let t = 0;
  const google = fakeGoogle();
  const auth = googleAuth({ google, now: () => t });
  await auth.signIn();
  t = 3600 * 1000;
  assert.equal(await auth.getToken(), "tok2");
  assert.deepEqual(google.requests[1], { prompt: "none", hint: "me@gmail.com" });

  const strict = fakeGoogle({ failSilent: true });
  const auth2 = googleAuth({ google: strict, now: () => t });
  await auth2.signIn();
  t += 3600 * 1000;
  await assert.rejects(auth2.getToken(), (e) => e instanceof StorageError && e.kind === ErrorKind.auth);
});

test("Google: autoSignIn works only quietly; no hint means no token", async () => {
  const google = fakeGoogle();
  const auth = googleAuth({ google });
  assert.equal(auth.canAutoSignIn(undefined), false);
  assert.equal(auth.canAutoSignIn("me@gmail.com"), true);
  assert.deepEqual(await auth.autoSignIn("me@gmail.com"), { id: "me@gmail.com", name: "me@gmail.com" });
  assert.deepEqual(google.requests[0], { prompt: "none", hint: "me@gmail.com" });
  await assert.rejects(googleAuth({ google }).getToken(), (e) => e.kind === ErrorKind.auth);
  await assert.rejects(googleAuth({ google: fakeGoogle({ failSilent: true }) }).autoSignIn("me@gmail.com"), (e) => e.kind === ErrorKind.auth);
});

test("Google: restore resumes a saved session only while its token is good", async () => {
  let t = 0;
  const store = storage();
  const a = googleAuth({ google: fakeGoogle(), storage: store, now: () => t });
  await a.signIn();
  const b = googleAuth({ google: fakeGoogle(), storage: store, now: () => t });
  assert.equal((await b.restore()).name, "me@gmail.com");
  t = 3600 * 1000;
  const c = googleAuth({ google: fakeGoogle(), storage: store, now: () => t });
  assert.equal(await c.restore(), undefined);
});

test("Google: signOut revokes the token and forgets; forget does not call Google", async () => {
  const google = fakeGoogle();
  const auth = googleAuth({ google });
  await auth.signIn();
  await auth.signOut();
  assert.deepEqual(google.revoked, ["tok1"]);
  assert.equal(await auth.restore(), undefined);
  await auth.signIn();
  await auth.forget();
  assert.deepEqual(google.revoked, ["tok1"]);
});

// ---- Microsoft ------------------------------------------------------------------------------------------------

function fakeMsal({ accounts = [], redirectResult = null, silentFails = false, ssoFails = false } = {}) {
  const calls = [];
  class PublicClientApplication {
    constructor(config) { calls.push(["config", config]); this.active = null; }
    async initialize() { calls.push(["initialize"]); }
    async handleRedirectPromise() { return redirectResult; }
    getAllAccounts() { return accounts; }
    setActiveAccount(a) { this.active = a; }
    async acquireTokenSilent(r) { calls.push(["silent", r]); if (silentFails) throw new Error("interaction_required"); return { accessToken: "ms-token" }; }
    async ssoSilent(r) { calls.push(["sso", r]); if (ssoFails) throw new Error("login_required"); return { account: accounts[0] }; }
    loginRedirect(r) { calls.push(["redirect", r]); return Promise.resolve(); }
    async loginPopup(r) { calls.push(["popup", r]); return { account: accounts[0] }; }
    async clearCache(r) { calls.push(["clear", r]); }
  }
  return { msal: { PublicClientApplication }, calls };
}
const acct = { homeAccountId: "h1", username: "me@outlook.com" };
const msAuth = (m, extra = {}) => createMicrosoftAuth({ msal: m.msal, clientId: "cid", redirectUri: "https://x/", ...extra });

test("Microsoft: restore resumes a remembered account or one returned by a redirect", async () => {
  const m = fakeMsal({ accounts: [acct] });
  assert.deepEqual(await msAuth(m).restore(), { id: "h1", name: "me@outlook.com" });
  assert.deepEqual(m.calls[0][1].auth, { clientId: "cid", authority: "https://login.microsoftonline.com/common", redirectUri: "https://x/" });
  assert.equal(m.calls[0][1].cache.cacheLocation, "localStorage");
  const back = fakeMsal({ redirectResult: { account: acct } });
  assert.equal((await msAuth(back).restore()).name, "me@outlook.com");
  assert.equal(await msAuth(fakeMsal()).restore(), undefined);
});

test("Microsoft: getToken is silent; when renewal fails it is an auth error", async () => {
  const m = fakeMsal({ accounts: [acct] });
  const auth = msAuth(m);
  await assert.rejects(auth.getToken(), (e) => e.kind === ErrorKind.auth);
  await auth.restore();
  assert.equal(await auth.getToken(), "ms-token");
  assert.deepEqual(m.calls.find((c) => c[0] === "silent")[1].scopes, ["Files.ReadWrite.All", "User.Read"]);
  const bad = fakeMsal({ accounts: [acct], silentFails: true });
  const a2 = msAuth(bad);
  await a2.restore();
  await assert.rejects(a2.getToken(), (e) => e.kind === ErrorKind.auth);
});

test("Microsoft: signIn uses a login hint when there is one, otherwise an account picker", async () => {
  const m = fakeMsal({ accounts: [acct] });
  const auth = msAuth(m, { mode: "popup" });
  await auth.signIn();
  assert.deepEqual(m.calls.at(-1), ["popup", { scopes: ["Files.ReadWrite.All", "User.Read"], prompt: "select_account" }]);
  await auth.signIn("me@outlook.com");
  assert.equal(m.calls.at(-1)[1].loginHint, "me@outlook.com");
  assert.equal(m.calls.at(-1)[1].prompt, undefined);
});

test("Microsoft: autoSignIn tries a quiet sign-in first, then (redirect mode) a redirect with the hint", async () => {
  const quiet = fakeMsal({ accounts: [acct] });
  assert.equal((await msAuth(quiet).autoSignIn("me@outlook.com")).name, "me@outlook.com");

  const fallback = fakeMsal({ accounts: [acct], ssoFails: true });
  let resolved = false;
  void msAuth(fallback).autoSignIn("me@outlook.com").then(() => { resolved = true; });
  await new Promise((r) => setImmediate(r));
  assert.equal(fallback.calls.at(-1)[0], "redirect");
  assert.equal(fallback.calls.at(-1)[1].loginHint, "me@outlook.com");
  assert.equal(resolved, false); // the page is navigating away

  await assert.rejects(msAuth(fakeMsal({ accounts: [acct], ssoFails: true }), { mode: "popup" }).autoSignIn("me@outlook.com"));
  assert.equal(msAuth(quiet).canAutoSignIn(undefined), false);
  assert.equal(msAuth(quiet).canAutoSignIn("x"), true);
});

test("Microsoft: signOut clears this browser's tokens only", async () => {
  const m = fakeMsal({ accounts: [acct] });
  const auth = msAuth(m);
  await auth.restore();
  await auth.signOut();
  assert.equal(m.calls.at(-1)[0], "clear");
  assert.equal(m.calls.some((c) => c[0] === "redirect"), false);
  await assert.rejects(auth.getToken(), (e) => e.kind === ErrorKind.auth);
});

// ---- Google Picker --------------------------------------------------------------------------------------------

function fakePicker(result) {
  const seen = { views: [], multi: false };
  class DocsView {
    constructor(id) { this.id = id; this.calls = []; seen.views.push(this); }
    setIncludeFolders(v) { this.calls.push(["includeFolders", v]); return this; }
    setSelectFolderEnabled(v) { this.calls.push(["selectFolder", v]); return this; }
    setOwnedByMe(v) { this.calls.push(["ownedByMe", v]); return this; }
    setMimeTypes(v) { this.calls.push(["mime", v]); return this; }
    setParent(v) { this.calls.push(["parent", v]); return this; }
  }
  class PickerBuilder {
    addView() { return this; }
    enableFeature() { seen.multi = true; return this; }
    setOAuthToken(t) { seen.token = t; return this; }
    setDeveloperKey(k) { seen.key = k; return this; }
    setAppId(a) { seen.app = a; return this; }
    setTitle(t) { seen.title = t; return this; }
    setCallback(cb) { this.cb = cb; return this; }
    build() { return { setVisible: () => this.cb(result) }; }
  }
  return { seen, picker: { DocsView, PickerBuilder, ViewId: { FOLDERS: "F", DOCS: "D" }, Feature: { MULTISELECT_ENABLED: "M" }, Action: { PICKED: "picked", CANCEL: "cancel" } } };
}

test("Picker: pickFolder returns a folder reference, or null when closed", async () => {
  const ok = fakePicker({ action: "picked", docs: [{ id: "F9", name: "My PBE" }] });
  assert.deepEqual(await pickFolder({ token: "t", apiKey: "k", appId: "a", picker: ok.picker }), { provider: "google", id: "F9", name: "My PBE" });
  assert.deepEqual([ok.seen.token, ok.seen.key, ok.seen.app], ["t", "k", "a"]);
  assert.equal(await pickFolder({ token: "t", apiKey: "k", appId: "a", picker: fakePicker({ action: "cancel" }).picker }), null);
});

test("Picker: pickFiles can start inside a folder and select several files", async () => {
  const f = fakePicker({ action: "picked", docs: [{ id: "1", name: "a" }, { id: "2", name: "b" }] });
  const files = await pickFiles({ token: "t", apiKey: "k", appId: "a", parent: "FOLDER", multi: true, picker: f.picker });
  assert.deepEqual(files, [{ id: "1", name: "a" }, { id: "2", name: "b" }]);
  assert.equal(f.seen.multi, true);
  assert.deepEqual(f.seen.views[0].calls.find((c) => c[0] === "parent"), ["parent", "FOLDER"]);
});

test("Microsoft: can share an existing MSAL client, and a popup-style app never navigates for a quiet sign-in", async () => {
  const m = fakeMsal({ accounts: [acct], ssoFails: true });
  const shared = new m.msal.PublicClientApplication({ auth: {} });
  const constructed = m.calls.filter((c) => c[0] === "config").length;
  const auth = createMicrosoftAuth({ pca: shared, clientId: "cid", redirectUri: "https://x/", mode: "popup", autoRedirect: false });
  assert.equal((await auth.restore()).name, "me@outlook.com");
  assert.equal(m.calls.filter((c) => c[0] === "config").length, constructed); // no second client
  await assert.rejects(auth.autoSignIn("me@outlook.com"));
  assert.equal(m.calls.some((c) => c[0] === "redirect"), false);
  const redirecting = createMicrosoftAuth({ pca: shared, clientId: "cid", redirectUri: "https://x/", mode: "popup", autoRedirect: true });
  void redirecting.autoSignIn("me@outlook.com");
  await new Promise((r) => setImmediate(r));
  assert.equal(m.calls.at(-1)[0], "redirect");
});
