import test from "node:test";
import assert from "node:assert/strict";
import { DocSync } from "../sync/engine.js";
import { MemoryBackend } from "../providers/memory.js";
import { ErrorKind, StorageError } from "../errors.js";
import { mergeRecords } from "../merge.js";
import { encodeEnvelope, makeEnvelope, stableStringify } from "../envelope.js";

const merge = (a, b) => ({ playlists: mergeRecords(a.playlists, b.playlists) });
const pl = (id, updatedAt, name, extra = {}) => ({ id, updatedAt, createdAt: Number(id.slice(1)) || 0, name, ...extra });
const opts = (local) => ({ schema: 2, local, merge });
const names = (state) => state.playlists.filter((p) => !p.deleted).map((p) => `${p.id}:${p.name}`);

async function setup({ visibility = "all", users = ["a", "b", "c"] } = {}) {
  const cloud = new MemoryBackend();
  const owner = cloud.createProvider(users[0], { visibility });
  const root = await owner.createRoot("space");
  const providers = [owner];
  for (const u of users.slice(1)) { owner.share(root, u, "editor"); providers.push(cloud.createProvider(u, { visibility })); }
  const devices = providers.map((provider, i) => new DocSync({ provider, folder: root, app: "karaoke", deviceId: `dev${i}0000`, now: () => 1000 + i }));
  return { cloud, root, providers, devices };
}

test("three devices converge to the same state in any order of syncing", async () => {
  const { devices } = await setup();
  let a = { playlists: [pl("p1", 1, "Alpha")] };
  let b = { playlists: [pl("p2", 2, "Beta")] };
  let c = { playlists: [pl("p3", 3, "Gamma"), pl("p1", 5, "Alpha renamed")] };
  for (const round of [0, 1, 2]) {
    a = (await devices[0].sync("state", opts(a))).merged;
    c = (await devices[2].sync("state", opts(c))).merged;
    b = (await devices[1].sync("state", opts(b))).merged;
  }
  assert.equal(stableStringify(a), stableStringify(b));
  assert.equal(stableStringify(b), stableStringify(c));
  assert.deepEqual(names(a), ["p1:Alpha renamed", "p2:Beta", "p3:Gamma"]);
});

test("a deletion on one device reaches the others and stays deleted", async () => {
  const { devices } = await setup({ users: ["a", "b"] });
  let a = { playlists: [pl("p1", 1, "Alpha")] };
  let b = { playlists: [] };
  a = (await devices[0].sync("state", opts(a))).merged;
  b = (await devices[1].sync("state", opts(b))).merged;
  assert.deepEqual(names(b), ["p1:Alpha"]);
  b = { playlists: b.playlists.map((p) => ({ ...p, deleted: true, updatedAt: 10 })) };
  b = (await devices[1].sync("state", opts(b))).merged;
  a = (await devices[0].sync("state", opts(a))).merged;
  assert.deepEqual(names(a), []);
  a = (await devices[0].sync("state", opts(a))).merged;
  assert.deepEqual(names(a), []);
});

test("a settled sync neither uploads nor downloads anything", async () => {
  const { devices, cloud } = await setup({ users: ["a", "b"] });
  let a = { playlists: [pl("p1", 1, "Alpha")] };
  let b = { playlists: [pl("p2", 2, "Beta")] };
  for (let i = 0; i < 3; i++) { a = (await devices[0].sync("state", opts(a))).merged; b = (await devices[1].sync("state", opts(b))).merged; }
  let reads = 0, writes = 0;
  for (const d of devices) {
    const read = d.provider.read.bind(d.provider), write = d.provider.write.bind(d.provider);
    d.provider.read = (...x) => { reads++; return read(...x); };
    d.provider.write = (...x) => { writes++; return write(...x); };
  }
  const r1 = await devices[0].sync("state", opts(a));
  const r2 = await devices[1].sync("state", opts(b));
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  assert.equal(r1.changed || r2.changed || r1.pushed || r2.pushed, false);
  void cloud;
});

test("a restarted device does not rewrite a file that already holds its data", async () => {
  const { devices, root, providers } = await setup({ users: ["a"] });
  const state = { playlists: [pl("p1", 1, "Alpha")] };
  await devices[0].sync("state", opts(state));
  const fresh = new DocSync({ provider: providers[0], folder: root, app: "karaoke", deviceId: "dev00000" });
  let writes = 0;
  const write = providers[0].write.bind(providers[0]);
  providers[0].write = (...x) => { writes++; return write(...x); };
  const r = await fresh.sync("state", opts(state));
  assert.equal(writes, 0);
  assert.equal(r.pushed, false);
});

test("a viewer merges what others wrote but never uploads", async () => {
  const cloud = new MemoryBackend();
  const a = cloud.createProvider("a");
  const v = cloud.createProvider("v");
  const root = await a.createRoot("space");
  a.share(root, "v", "viewer");
  const da = new DocSync({ provider: a, folder: root, app: "karaoke", deviceId: "owner0001" });
  const dv = new DocSync({ provider: v, folder: root, app: "karaoke", deviceId: "viewer001" });
  await da.sync("state", opts({ playlists: [pl("p1", 1, "From leader")] }));
  await dv.refreshAccess();
  assert.equal(dv.readOnly, true);
  const r = await dv.sync("state", opts({ playlists: [] }));
  assert.deepEqual(names(r.merged), ["p1:From leader"]);
  assert.equal(r.pushed, false);
  assert.equal((await a.list(root)).length, 1);
});

test("a forbidden upload turns a device read-only instead of failing the sync", async () => {
  const cloud = new MemoryBackend();
  const a = cloud.createProvider("a");
  const v = cloud.createProvider("v");
  const root = await a.createRoot("space");
  a.share(root, "v", "viewer");
  const dv = new DocSync({ provider: v, folder: root, app: "karaoke", deviceId: "viewer001" });
  const r = await dv.sync("state", opts({ playlists: [pl("p9", 1, "Mine")] }));
  assert.equal(r.pushed, false);
  assert.equal(dv.readOnly, true);
});

test("Google-like visibility: nothing merges until the other person's file is picked", async () => {
  const { devices, providers } = await setup({ visibility: "own", users: ["a", "b"] });
  const a = (await devices[0].sync("state", opts({ playlists: [pl("p1", 1, "Alpha")] }))).merged;
  let b = (await devices[1].sync("state", opts({ playlists: [pl("p2", 2, "Beta")] }))).merged;
  assert.deepEqual(names(b), ["p2:Beta"]);
  const listing = await providers[0].list(devices[0].folder);
  assert.equal(listing.length, 1);
  const mine = (await providers[1].list(devices[1].folder))[0];
  providers[1].pick((await providers[0].list(devices[0].folder))[0]);
  b = (await devices[1].sync("state", opts(b))).merged;
  assert.deepEqual(names(b), ["p1:Alpha", "p2:Beta"]);
  void mine; void a;
});

test("stray files, other apps' files and newer schemas are not merged", async () => {
  const { devices, providers, root } = await setup({ users: ["a", "b"] });
  const enc = (o) => encodeEnvelope(makeEnvelope({ deviceId: "zzzz0000", updatedAt: 1, kind: "state", app: "karaoke", schema: 2, data: { playlists: [pl("x", 1, "X")] }, ...o }));
  await providers[1].write(root, "state.junk0000.json", new TextEncoder().encode("not json"));
  await providers[1].write(root, "state.quiz00000.json", enc({ app: "quiz" }));
  await providers[1].write(root, "state.other0000.json", enc({ kind: "history" }));
  await providers[1].write(root, "state.future000.json", enc({ schema: 3 }));
  await providers[1].write(root, "notes.txt", new TextEncoder().encode("hi"));
  const r = await devices[0].sync("state", opts({ playlists: [pl("p1", 1, "Alpha")] }));
  assert.deepEqual(names(r.merged), ["p1:Alpha"]);
  assert.equal(r.remotes, 0);
  assert.equal(r.newerSchema, true);
  assert.equal(r.skipped.length, 3);
});

test("a failed sync leaves local data alone and the next one recovers", async () => {
  const { devices, cloud } = await setup({ users: ["a", "b"] });
  const local = { playlists: [pl("p1", 1, "Alpha")] };
  cloud.injectFailure(new StorageError(ErrorKind.network, "offline"));
  await assert.rejects(devices[0].sync("state", opts(local)), (e) => e.kind === ErrorKind.network);
  const r = await devices[0].sync("state", opts(local));
  assert.equal(r.pushed, true);
});

test("a lost own file is rebuilt by the next sync", async () => {
  const { devices, providers, root } = await setup({ users: ["a", "b"] });
  const local = { playlists: [pl("p1", 1, "Alpha")] };
  await devices[0].sync("state", opts(local));
  const [file] = await providers[0].list(root);
  await providers[0].remove(root, file);
  devices[0].lastPushed.clear();
  const r = await devices[0].sync("state", opts(local));
  assert.equal(r.pushed, true);
  assert.equal((await providers[0].list(root)).length, 1);
});

test("different documents in one folder do not interfere", async () => {
  const { devices } = await setup({ users: ["a", "b"] });
  await devices[0].sync("state", opts({ playlists: [pl("p1", 1, "Alpha")] }));
  const r = await devices[1].sync("history", { schema: 1, local: { playlists: [] }, merge });
  assert.equal(r.remotes, 0);
});
