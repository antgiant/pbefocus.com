import test from "node:test";
import assert from "node:assert/strict";
import { OneDriveProvider } from "../providers/onedrive.js";
import { ErrorKind } from "../errors.js";
import { bytes, fakeFetch, noSleep, text } from "./helpers.js";

const folder = { provider: "microsoft", id: "F1", driveId: "D1", name: "Space" };
const make = (routes, extra = {}) => {
  const fetch = fakeFetch(routes);
  const tokens = [];
  const provider = new OneDriveProvider({ getToken: async (force) => { tokens.push(force); return "tok"; }, fetch, sleep: noSleep, ...extra });
  return { provider, fetch, tokens };
};

test("list maps entries, follows paging, and carries the drive of a shortcut folder", async () => {
  const { provider, fetch } = make([
    { match: "/drives/D1/items/F1/children", reply: ({ url }) => ({ json: url.includes("page2") ? { value: [{ id: "B", name: "b.json", eTag: "e2", size: 3 }] } : { value: [{ id: "A", name: "a.json", eTag: "e1", size: 5, lastModifiedDateTime: "t" }, { id: "S", name: "shared", remoteItem: { id: "R", folder: {}, parentReference: { driveId: "D9" } } }], "@odata.nextLink": "https://graph.microsoft.com/v1.0/page2" } }) },
    { match: "page2", reply: { json: { value: [{ id: "B", name: "b.json", eTag: "e2", size: 3 }] } } },
  ]);
  const entries = await provider.list(folder);
  assert.deepEqual(entries.map((e) => [e.name, e.folder, e.tag]), [["a.json", false, "e1"], ["shared", true, undefined], ["b.json", false, "e2"]]);
  assert.deepEqual(entries[1], { id: "R", name: "shared", tag: undefined, modified: undefined, size: undefined, folder: true, driveId: "D9" });
  assert.equal(fetch.calls[0].headers.get("authorization"), "Bearer tok");
});

test("read fetches the pre-authorized download address without sending the token", async () => {
  const { provider, fetch } = make([
    { match: "/items/A?", reply: { json: { id: "A", "@microsoft.graph.downloadUrl": "https://cdn.example/file" } } },
    { match: "cdn.example", reply: { bytes: "hello" } },
  ]);
  assert.equal(text(await provider.read(folder, { id: "A" })), "hello");
  assert.equal(fetch.calls[1].headers.get("authorization"), null);
});

test("write puts the bytes by path with replace semantics and an encoded name", async () => {
  const { provider, fetch } = make([{ match: ":/content", method: "PUT", reply: { json: { id: "N", name: "a b.json", eTag: "e1", size: 2 } } }]);
  const entry = await provider.write(folder, "a b.json", bytes("{}"));
  assert.equal(entry.id, "N");
  assert.match(fetch.calls[0].url, /\/drives\/D1\/items\/F1:\/a%20b\.json:\/content\?@microsoft\.graph\.conflictBehavior=replace$/);
  await assert.rejects(provider.write(folder, "big", new Uint8Array(5 * 1024 * 1024)), (e) => e.kind === ErrorKind.invalid);
});

test("ensureFolder reuses a folder, creates one, and survives a creation race", async () => {
  let made = false;
  const { provider } = make([
    { match: "/children?", method: "GET", reply: () => ({ json: { value: made ? [{ id: "K", name: "karaoke", folder: {}, parentReference: { driveId: "D1" } }] : [] } }) },
    { match: "/children", method: "POST", reply: () => { made = true; return { status: 409, json: { error: { code: "nameAlreadyExists", message: "exists" } } }; } },
  ]);
  const ref = await provider.ensureFolder(folder, "karaoke");
  assert.equal(ref.id, "K");
  assert.equal(ref.driveId, "D1");
  const { provider: p2, fetch } = make([
    { match: "/children?", method: "GET", reply: { json: { value: [{ id: "K", name: "karaoke", folder: {}, parentReference: { driveId: "D1" } }] } } },
  ]);
  assert.equal((await p2.ensureFolder(folder, "karaoke")).id, "K");
  assert.equal(fetch.calls.filter((c) => c.method === "POST").length, 0);
});

test("errors map onto kinds; 401 refreshes the token once; 429 and 5xx retry", async () => {
  const cases = [[404, ErrorKind.notFound], [403, ErrorKind.forbidden], [400, ErrorKind.invalid], [409, ErrorKind.exists]];
  for (const [status, kind] of cases) {
    const { provider } = make([{ match: "/children", reply: { status, json: { error: { code: "x", message: "nope" } } } }]);
    await assert.rejects(provider.list(folder), (e) => e.kind === kind && e.status === status && /nope/.test(e.message));
  }
  const { provider, tokens } = make([{ match: "/children", reply: ({ headers }, calls) => (calls.length === 1 ? { status: 401, text: "{}" } : { json: { value: [] } }) }]);
  assert.deepEqual(await provider.list(folder), []);
  assert.deepEqual(tokens, [false, true]);

  let n = 0;
  const slept = [];
  const retry = make([{ match: "/children", reply: () => (++n < 3 ? { status: 429, text: "{}", headers: { "retry-after": "2" } } : { json: { value: [] } }) }], { sleep: async (ms) => { slept.push(ms); } });
  assert.deepEqual(await retry.provider.list(folder), []);
  assert.deepEqual(slept, [2000, 2000]);

  const dead = make([{ match: "/children", reply: { status: 503, text: "{}" } }], { maxRetries: 1 });
  await assert.rejects(dead.provider.list(folder), (e) => e.status === 503);
});

test("network failures are retried then reported as network errors", async () => {
  let calls = 0;
  const provider = new OneDriveProvider({ getToken: async () => "t", fetch: async () => { calls++; throw new TypeError("offline"); }, sleep: noSleep, maxRetries: 2 });
  await assert.rejects(provider.list(folder), (e) => e.kind === ErrorKind.network);
  assert.equal(calls, 3);
});

test("resolveLink encodes the link, returns a folder, rejects files", async () => {
  const link = "https://1drv.ms/f/c/abc/Def?e=1";
  const { provider, fetch } = make([{ match: "/shares/", reply: { json: { id: "R", name: "PBE", folder: {}, parentReference: { driveId: "D7" } } } }]);
  assert.deepEqual(await provider.resolveLink(link), { provider: "microsoft", id: "R", driveId: "D7", name: "PBE" });
  const token = "u!" + Buffer.from(link).toString("base64").replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
  assert.ok(fetch.calls[0].url.includes(`/shares/${token}/driveItem`));
  const { provider: p2 } = make([{ match: "/shares/", reply: { json: { id: "R", name: "x.docx", file: {}, parentReference: { driveId: "D7" } } } }]);
  await assert.rejects(p2.resolveLink(link), (e) => e.kind === ErrorKind.invalid);
});

test("invite maps roles and returns the link; createLink returns the web address", async () => {
  const { provider, fetch } = make([
    { match: "/invite", reply: { json: { value: [{ link: { webUrl: "https://1drv.ms/f/x" } }] } } },
    { match: "/createLink", reply: { json: { link: { webUrl: "https://1drv.ms/f/y" } } } },
  ]);
  assert.deepEqual(await provider.invite(folder, "a@b.c", "viewer"), { link: "https://1drv.ms/f/x" });
  assert.deepEqual(JSON.parse(fetch.calls[0].body).roles, ["read"]);
  await provider.invite(folder, "a@b.c", "editor");
  assert.deepEqual(JSON.parse(fetch.calls[1].body).roles, ["write"]);
  assert.equal(await provider.createLink(folder, { type: "view", scope: "anonymous" }), "https://1drv.ms/f/y");
  assert.deepEqual(JSON.parse(fetch.calls[2].body), { type: "view", scope: "anonymous" });
});

test("browse lists only folders; createFolder renames on a clash", async () => {
  const { provider, fetch } = make([
    { match: "/me/drive/root/children?", reply: { json: { value: [{ id: "1", name: "Docs", folder: {}, parentReference: { driveId: "D1" } }, { id: "2", name: "a.txt", file: {}, parentReference: { driveId: "D1" } }] } } },
    { match: "/me/drive/root/children", method: "POST", reply: { json: { id: "3", name: "PBE data", folder: {}, parentReference: { driveId: "D1" } } } },
  ]);
  assert.deepEqual((await provider.browse()).map((f) => f.name), ["Docs"]);
  const made = await provider.createFolder("PBE data");
  assert.equal(made.id, "3");
  assert.equal(JSON.parse(fetch.calls[1].body)["@microsoft.graph.conflictBehavior"], "rename");
});

test("the settings pointer reads back, and a missing one is undefined", async () => {
  const stored = {};
  const { provider } = make([
    { match: "approot:/pbe-pointer.json:/content", method: "PUT", reply: ({ body }) => { stored.v = body; return { json: { id: "p" } }; } },
    { match: "approot:/pbe-pointer.json:/content", method: "GET", reply: () => (stored.v ? { text: stored.v } : { status: 404, json: { error: { code: "itemNotFound", message: "gone" } } }) },
  ]);
  assert.equal(await provider.readPointer(), undefined);
  await provider.writePointer({ folder: { id: "F1" } });
  assert.deepEqual(await provider.readPointer(), { folder: { id: "F1" } });
});
