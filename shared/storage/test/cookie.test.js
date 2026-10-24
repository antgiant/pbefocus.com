import test from "node:test";
import assert from "node:assert/strict";
import { CookieStore, COOKIE_NAME, connect, disconnect, emptyState, normalize, parse, readCookieValue, reconcile, serialize, setFolder, setPrimary, signOutAll } from "../cookie.js";

const folder = { provider: "microsoft", id: "ITEM1", driveId: "D1", name: "My PBE data" };

test("serialize and parse round-trip, including folders and unicode", () => {
  let s = connect(emptyState(), { provider: "microsoft", hint: "zoë@example.com", folder }, 100);
  s = connect(s, { provider: "google", hint: "g@example.com" }, 200);
  s = setPrimary(s, "google");
  s = disconnect(s, "microsoft", 300);
  const back = parse(serialize(s));
  assert.deepEqual(back, normalize(s));
  assert.equal(back.primary, "google");
  assert.equal(back.out.microsoft, 300);
});

test("parse tolerates garbage and hostile input", () => {
  for (const bad of ["", undefined, null, "###", "e30", "bm90LWpzb24", serialize(emptyState()) + "!!"]) assert.deepEqual(parse(bad), emptyState());
  const hostile = normalize({
    v: 99,
    primary: "dropbox",
    accounts: [
      { provider: "evil", hint: "x", at: 1 },
      { provider: "google", hint: 5, at: 1 },
      { provider: "google", hint: "a@b.c", at: 10 },
      { provider: "google", hint: "newer@b.c", at: 20 },
      { provider: "microsoft", hint: "m@b.c", at: "soon" },
    ],
    out: { google: "yesterday", microsoft: 7, evil: 1 },
  });
  assert.equal(hostile.primary, "local");
  assert.deepEqual(hostile.accounts.map((a) => a.hint), ["newer@b.c"]);
  assert.deepEqual(hostile.out, { microsoft: 7 });
});

test("a primary that is not connected falls back to local", () => {
  assert.equal(normalize({ primary: "google", accounts: [] }).primary, "local");
  const s = connect(emptyState(), { provider: "google", hint: "a" }, 1);
  assert.equal(setPrimary(s, "microsoft").primary, "local");
  assert.equal(setPrimary(s, "google").primary, "google");
});

test("connect clears that provider's sign-out marker; disconnect sets it and resets the primary", () => {
  let s = connect(emptyState(), { provider: "google", hint: "a" }, 10);
  s = setPrimary(s, "google");
  s = disconnect(s, "google", 20);
  assert.equal(s.out.google, 20);
  assert.equal(s.primary, "local");
  assert.equal(s.accounts.length, 0);
  s = connect(s, { provider: "google", hint: "a" }, 30);
  assert.equal(s.out.google, undefined);
});

test("providers are independent; signOutAll marks every provider", () => {
  let s = connect(connect(emptyState(), { provider: "google", hint: "g" }, 1), { provider: "microsoft", hint: "m" }, 2);
  s = disconnect(s, "google", 5);
  assert.deepEqual(s.accounts.map((a) => a.provider), ["microsoft"]);
  const all = signOutAll(s, 9);
  assert.equal(all.accounts.length, 0);
  assert.deepEqual(all.out, { google: 9, microsoft: 9 });
});

test("setFolder updates a connected provider and ignores others", () => {
  let s = connect(emptyState(), { provider: "microsoft", hint: "m" }, 1);
  s = setFolder(s, "microsoft", folder);
  assert.deepEqual(s.accounts[0].folder, folder);
  assert.deepEqual(setFolder(s, "google", folder).accounts.length, 1);
  assert.equal(setFolder(s, "microsoft", undefined).accounts[0].folder, undefined);
});

test("reconcile: another app connected -> sign in here", () => {
  const s = connect(emptyState(), { provider: "microsoft", hint: "m@x" }, 100);
  assert.deepEqual(reconcile(s, {}), [{ type: "signIn", provider: "microsoft", hint: "m@x" }]);
});

test("reconcile: another app signed out after this one connected -> sign out here", () => {
  const s = disconnect(connect(emptyState(), { provider: "google", hint: "g" }, 100), "google", 200);
  assert.deepEqual(reconcile(s, { google: { connectedAt: 150 } }), [{ type: "signOut", provider: "google" }]);
});

test("reconcile: connecting again after the sign-out keeps the session", () => {
  const s = connect(disconnect(connect(emptyState(), { provider: "google", hint: "g" }, 100), "google", 200), { provider: "google", hint: "g" }, 300);
  assert.deepEqual(reconcile(s, { google: { connectedAt: 300 } }), []);
  assert.deepEqual(reconcile(s, { google: { connectedAt: 250 } }), []);
});

test("reconcile: the cookie is missing but this app is connected -> adopt it back", () => {
  assert.deepEqual(reconcile(emptyState(), { google: { connectedAt: 5, hint: "g" } }), [{ type: "adopt", provider: "google", hint: "g" }]);
  // a sign-out marker older than this session does not stop adoption
  const s = { ...emptyState(), out: { google: 3 } };
  assert.deepEqual(reconcile(s, { google: { connectedAt: 5, hint: "g" } }), [{ type: "adopt", provider: "google", hint: "g" }]);
});

test("reconcile handles each provider separately", () => {
  let s = connect(emptyState(), { provider: "microsoft", hint: "m" }, 50);
  s = disconnect(s, "google", 60);
  const actions = reconcile(s, { google: { connectedAt: 10 } });
  assert.deepEqual(actions, [{ type: "signOut", provider: "google" }, { type: "signIn", provider: "microsoft", hint: "m" }]);
});

test("CookieStore writes the right attributes and reads among other cookies", () => {
  const doc = { cookie: "" };
  const prod = new CookieStore({ document: doc, domain: ".pbefocus.com", now: () => 1 });
  prod.write(connect(emptyState(), { provider: "google", hint: "g" }, 1));
  assert.match(doc.cookie, new RegExp(`^${COOKIE_NAME}=[A-Za-z0-9_-]+; Path=/; Max-Age=31536000; SameSite=Lax; Domain=\\.pbefocus\\.com; Secure$`));
  const dev = new CookieStore({ document: doc, secure: false });
  dev.write(emptyState());
  assert.doesNotMatch(doc.cookie, /Domain|Secure/);

  const value = serialize(connect(emptyState(), { provider: "google", hint: "g" }, 1));
  const reader = new CookieStore({ document: { cookie: `a=1; ${COOKIE_NAME}=${value}; b=2` } });
  assert.equal(reader.read().accounts[0].hint, "g");
  assert.equal(readCookieValue("a=1; b=2"), "");
});

test("CookieStore.update applies a transition with the current time", () => {
  const doc = { cookie: "" };
  const store = new CookieStore({ document: { get cookie() { return doc.cookie; }, set cookie(v) { doc.cookie = v.split(";")[0]; } }, now: () => 777 });
  store.update((s, now) => connect(s, { provider: "microsoft", hint: "m" }, now));
  assert.equal(store.read().accounts[0].at, 777);
});
