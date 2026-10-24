import test from "node:test";
import assert from "node:assert/strict";
import { ConnectionRegistry, memoryStore } from "../registry.js";
import { CookieStore } from "../cookie.js";

/**
 * A pretend provider sign-in for ONE app. `local` is this app's own saved session (every app keeps its own tokens); `navigates`
 * imitates a redirect flow where signIn() never returns and the next page load restores the session.
 */
function fakeAuth({ account, navigates = false, silentWorks = true, restoredAtStart = false }) {
  const log = [];
  let local = restoredAtStart;
  return {
    log,
    async restore() { return local ? account : undefined; },
    async signIn() { log.push("signIn"); local = true; if (navigates) return new Promise(() => {}); },
    async signOut() { log.push("signOut"); local = false; },
    async forget() { log.push("forget"); local = false; },
    canAutoSignIn: () => silentWorks,
    async autoSignIn() { log.push("autoSignIn"); if (silentWorks) local = true; return silentWorks ? account : undefined; },
    async getToken() { return "token"; },
  };
}

function makeApp({ cookieDoc, accounts, clock, navigates = {}, silent = {}, restored = {} }) {
  const cookie = new CookieStore({ document: cookieDoc, now: () => clock.t, secure: false });
  const store = memoryStore();
  const auths = {
    google: fakeAuth({ account: accounts.google, navigates: navigates.google, silentWorks: silent.google ?? true, restoredAtStart: restored.google }),
    microsoft: fakeAuth({ account: accounts.microsoft, navigates: navigates.microsoft, silentWorks: silent.microsoft ?? true, restoredAtStart: restored.microsoft }),
  };
  const providers = {
    google: { label: "Google Drive", auth: auths.google, createProvider: (a) => ({ kind: "google", auth: a }) },
    microsoft: { label: "OneDrive", auth: auths.microsoft, createProvider: (a) => ({ kind: "onedrive", auth: a }) },
  };
  const registry = new ConnectionRegistry({ cookie, providers, store, now: () => clock.t });
  return { registry, cookie, store, auths };
}

function browser() {
  // One cookie jar shared by every app opened in this "browser".
  const jar = { value: "" };
  const cookieDoc = { get cookie() { return jar.value; }, set cookie(v) { jar.value = v.split(";")[0]; } };
  const accounts = { google: { id: "g1", name: "me@gmail.com" }, microsoft: { id: "m1", name: "me@outlook.com" } };
  return { cookieDoc, accounts, clock: { t: 1000 } };
}

test("connecting in one app signs the other app in on its next reconcile", async () => {
  const b = browser();
  const one = makeApp(b);
  const two = makeApp(b);
  await one.registry.init();
  await two.registry.init();
  assert.equal(two.registry.isConnected("google"), false);

  b.clock.t = 2000;
  await one.registry.connect("google");
  assert.equal(one.registry.isConnected("google"), true);

  await two.registry.reconcile();
  assert.equal(two.registry.isConnected("google"), true);
  assert.deepEqual(two.auths.google.log, ["autoSignIn"]);
  assert.equal(two.registry.providerFor("google").kind, "google");
});

test("signing out in one app signs the other out, but only for that provider", async () => {
  const b = browser();
  const one = makeApp(b);
  const two = makeApp(b);
  await one.registry.init(); await two.registry.init();
  b.clock.t = 2000; await one.registry.connect("google");
  b.clock.t = 2100; await one.registry.connect("microsoft");
  await two.registry.reconcile();
  assert.equal(two.registry.isConnected("google") && two.registry.isConnected("microsoft"), true);

  b.clock.t = 3000;
  await one.registry.disconnect("google");
  await two.registry.reconcile();
  assert.equal(two.registry.isConnected("google"), false);
  assert.equal(two.registry.isConnected("microsoft"), true);
  assert.deepEqual(two.auths.google.log.slice(-1), ["forget"]);
  assert.equal(two.auths.microsoft.log.includes("forget"), false);
});

test("signing in again after a sign-out is not undone by the old marker", async () => {
  const b = browser();
  const one = makeApp(b);
  const two = makeApp(b);
  await one.registry.init(); await two.registry.init();
  b.clock.t = 2000; await one.registry.connect("google"); await two.registry.reconcile();
  b.clock.t = 3000; await one.registry.disconnect("google");
  b.clock.t = 4000; await two.registry.reconcile();
  assert.equal(two.registry.isConnected("google"), false);
  b.clock.t = 5000; await two.registry.connect("google");
  await one.registry.reconcile();
  assert.equal(one.registry.isConnected("google"), true);
  assert.equal(two.registry.isConnected("google"), true);
});

test("signOutAll signs out everything everywhere", async () => {
  const b = browser();
  const one = makeApp(b);
  const two = makeApp(b);
  await one.registry.init(); await two.registry.init();
  b.clock.t = 2000; await one.registry.connect("google"); await one.registry.connect("microsoft");
  await two.registry.reconcile();
  b.clock.t = 3000; await one.registry.signOutAll();
  await two.registry.reconcile();
  assert.deepEqual(two.registry.status().map((s) => s.connected), [false, false]);
  assert.equal(two.cookie.read().accounts.length, 0);
});

test("a redirect sign-in is finished by init() on the next page load", async () => {
  const b = browser();
  const first = makeApp({ ...b, navigates: { microsoft: true } });
  await first.registry.init();
  void first.registry.connect("microsoft"); // never resolves: the page navigated away
  await new Promise((r) => setImmediate(r));
  assert.equal(first.store.getItem("pbe.pendingConnect"), "microsoft");

  b.clock.t = 2000;
  const reloaded = makeApp({ ...b, restored: { microsoft: true } });
  reloaded.store.setItem("pbe.pendingConnect", "microsoft"); // same browser storage across the reload
  await reloaded.registry.init();
  assert.equal(reloaded.registry.isConnected("microsoft"), true);
  assert.equal(reloaded.cookie.read().accounts[0].provider, "microsoft");
  assert.equal(reloaded.store.getItem("pbe.pendingConnect"), null);
});

test("a restored session the cookie has never heard of is adopted into the cookie", async () => {
  const b = browser();
  const app = makeApp({ ...b, restored: { google: true } });
  await app.registry.init();
  assert.equal(app.registry.isConnected("google"), true);
  assert.equal(app.cookie.read().accounts[0].hint, "me@gmail.com");
});

test("a failed quiet sign-in is tried once and then offers Reconnect", async () => {
  const b = browser();
  const one = makeApp(b);
  await one.registry.init();
  b.clock.t = 2000; await one.registry.connect("google");
  const two = makeApp({ ...b, silent: { google: false } });
  await two.registry.init();
  await two.registry.reconcile();
  await two.registry.reconcile();
  assert.equal(two.registry.isConnected("google"), false);
  assert.equal(two.registry.status()[0].needsReconnect, true);
  assert.equal(two.auths.google.log.filter((l) => l === "autoSignIn").length, 0); // canAutoSignIn was false, so never attempted
});

test("quiet sign-in is attempted only once per page load", async () => {
  const b = browser();
  const one = makeApp(b);
  await one.registry.init();
  b.clock.t = 2000; await one.registry.connect("google");
  const two = makeApp(b);
  two.auths.google.autoSignIn = async () => { two.auths.google.log.push("autoSignIn"); throw new Error("needs interaction"); };
  await two.registry.init();
  await two.registry.reconcile(); await two.registry.reconcile(); await two.registry.reconcile();
  assert.equal(two.auths.google.log.filter((l) => l === "autoSignIn").length, 1);
  assert.equal(two.registry.status()[0].needsReconnect, true);
});

test("primary storage and chosen folder are shared through the cookie", async () => {
  const b = browser();
  const one = makeApp(b);
  const two = makeApp(b);
  await one.registry.init(); await two.registry.init();
  b.clock.t = 2000; await one.registry.connect("microsoft");
  one.registry.setPrimary("microsoft");
  one.registry.setFolder("microsoft", { provider: "microsoft", id: "F1", driveId: "D1", name: "PBE data" });
  assert.equal(two.registry.primary(), "microsoft");
  assert.equal(two.registry.folderFor("microsoft").name, "PBE data");
  assert.equal(two.registry.status().find((s) => s.provider === "microsoft").primary, true);
});

test("providerFor requires a connection and reuses the instance", async () => {
  const b = browser();
  const app = makeApp(b);
  await app.registry.init();
  assert.throws(() => app.registry.providerFor("google"), /Not connected/);
  await app.registry.connect("google");
  assert.equal(app.registry.providerFor("google"), app.registry.providerFor("google"));
});
