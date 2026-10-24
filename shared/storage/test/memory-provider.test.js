import test from "node:test";
import assert from "node:assert/strict";
import { MemoryBackend } from "../providers/memory.js";
import { ErrorKind, StorageError } from "../errors.js";

const bytes = (s) => new TextEncoder().encode(s);

test("roles: owner and editor write, viewer reads, outsider cannot even list", async () => {
  const cloud = new MemoryBackend();
  const a = cloud.createProvider("a");
  const editor = cloud.createProvider("e");
  const viewer = cloud.createProvider("v");
  const outsider = cloud.createProvider("o");
  const root = await a.createRoot("space");
  a.share(root, "e", "editor");
  a.share(root, "v", "viewer");

  await a.write(root, "f.json", bytes("1"));
  await editor.write(root, "g.json", bytes("2"));
  await assert.rejects(viewer.write(root, "h.json", bytes("3")), (e) => e instanceof StorageError && e.kind === ErrorKind.forbidden);
  assert.equal((await viewer.list(root)).length, 2);
  await assert.rejects(outsider.list(root), (e) => e.kind === ErrorKind.notFound);
  assert.equal(await a.access(root), "owner");
  assert.equal(await editor.access(root), "editor");
  assert.equal(await viewer.access(root), "viewer");
  assert.equal(await outsider.access(root), "none");
});

test("visibility 'own' shows only your own files until a file is picked (Google drive.file behavior)", async () => {
  const cloud = new MemoryBackend();
  const a = cloud.createProvider("a", { visibility: "own" });
  const b = cloud.createProvider("b", { visibility: "own" });
  const root = await a.createRoot("space");
  a.share(root, "b", "editor");
  const fa = await a.write(root, "a.json", bytes("A"));
  await b.write(root, "b.json", bytes("B"));
  assert.deepEqual((await a.list(root)).map((e) => e.name), ["a.json"]);
  assert.deepEqual((await b.list(root)).map((e) => e.name), ["b.json"]);
  b.pick(fa);
  assert.deepEqual((await b.list(root)).map((e) => e.name).sort(), ["a.json", "b.json"]);
  assert.equal(new TextDecoder().decode(await b.read(root, fa)), "A");
});

test("visibility 'all' shows everything in an accessible folder (OneDrive behavior)", async () => {
  const cloud = new MemoryBackend();
  const a = cloud.createProvider("a");
  const b = cloud.createProvider("b");
  const root = await a.createRoot("space");
  a.share(root, "b", "editor");
  await a.write(root, "a.json", bytes("A"));
  await b.write(root, "b.json", bytes("B"));
  assert.deepEqual((await a.list(root)).map((e) => e.name).sort(), ["a.json", "b.json"]);
});

test("write updates an existing file in place and changes its tag", async () => {
  const cloud = new MemoryBackend();
  const a = cloud.createProvider("a");
  const root = await a.createRoot("space");
  const first = await a.write(root, "f.json", bytes("1"));
  const second = await a.write(root, "f.json", bytes("22"), first);
  assert.equal(second.id, first.id);
  assert.notEqual(second.tag, first.tag);
  assert.equal((await a.list(root)).length, 1);
});

test("ensureFolder returns the existing folder; injected failures surface once", async () => {
  const cloud = new MemoryBackend();
  const a = cloud.createProvider("a");
  const root = await a.createRoot("space");
  const f1 = await a.ensureFolder(root, "karaoke");
  const f2 = await a.ensureFolder(root, "karaoke");
  assert.equal(f1.id, f2.id);
  cloud.injectFailure(new StorageError(ErrorKind.network, "offline"));
  await assert.rejects(a.list(root), (e) => e.kind === ErrorKind.network);
  assert.equal((await a.list(root)).length, 1);
});

test("only the owner removes a file", async () => {
  const cloud = new MemoryBackend();
  const a = cloud.createProvider("a");
  const b = cloud.createProvider("b");
  const root = await a.createRoot("space");
  a.share(root, "b", "editor");
  const f = await a.write(root, "f.json", bytes("1"));
  await assert.rejects(b.remove(root, f), (e) => e.kind === ErrorKind.forbidden);
  await a.remove(root, f);
  assert.equal((await a.list(root)).length, 0);
});
