import test from "node:test";
import assert from "node:assert/strict";
import { GoogleDriveProvider, GooglePublicReader } from "../providers/googledrive.js";
import { ErrorKind } from "../errors.js";
import { bytes, fakeFetch, noSleep, text } from "./helpers.js";

const folder = { provider: "google", id: "F1", name: "Space" };
const make = (routes, extra = {}) => {
  const fetch = fakeFetch(routes);
  const provider = new GoogleDriveProvider({ getToken: async () => "tok", fetch, sleep: noSleep, ...extra });
  return { provider, fetch };
};
const query = (call) => new URL(call.url).searchParams.get("q");

test("list queries the folder, escapes quotes, prefers the checksum as the change tag", async () => {
  const { provider, fetch } = make([{ match: "/drive/v3/files?", reply: { json: { files: [{ id: "A", name: "a.json", md5Checksum: "md5", version: "7", size: "12", modifiedTime: "t" }, { id: "B", name: "b", version: "3", mimeType: "application/vnd.google-apps.folder" }] } } }]);
  const entries = await provider.list({ ...folder, id: "it's" });
  assert.equal(query(fetch.calls[0]), "'it\\'s' in parents and trashed = false");
  assert.deepEqual(entries.map((e) => [e.name, e.tag, e.size, e.folder]), [["a.json", "md5", 12, false], ["b", "3", undefined, true]]);
});

test("list follows page tokens", async () => {
  const { provider } = make([{ match: "/drive/v3/files?", reply: ({ url }) => ({ json: url.includes("pageToken=T2") ? { files: [{ id: "B", name: "b" }] } : { files: [{ id: "A", name: "a" }], nextPageToken: "T2" } }) }]);
  assert.deepEqual((await provider.list(folder)).map((e) => e.id), ["A", "B"]);
});

test("write creates with a multipart upload and updates in place with a media upload", async () => {
  const { provider, fetch } = make([
    { match: "uploadType=multipart", method: "POST", reply: { json: { id: "N", name: "state.dev.json", md5Checksum: "m1" } } },
    { match: "/files/N?uploadType=media", method: "PATCH", reply: { json: { id: "N", name: "state.dev.json", md5Checksum: "m2" } } },
  ]);
  const created = await provider.write(folder, "state.dev.json", bytes('{"a":1}'));
  assert.equal(created.id, "N");
  assert.match(fetch.calls[0].headers.get("content-type"), /^multipart\/related; boundary=/);
  const sent = text(new Uint8Array(await fetch.calls[0].body.arrayBuffer()));
  assert.match(sent, /"name":"state\.dev\.json","parents":\["F1"\]/);
  assert.ok(sent.includes('{"a":1}'));
  const updated = await provider.write(folder, "state.dev.json", bytes("{}"), created);
  assert.equal(updated.tag, "m2");
  assert.equal(fetch.calls[1].method, "PATCH");
});

test("read downloads the bytes; remove deletes", async () => {
  const { provider, fetch } = make([{ match: "alt=media", reply: { bytes: "data" } }, { match: "/files/A?", method: "DELETE", reply: { status: 204 } }]);
  assert.equal(text(await provider.read(folder, { id: "A" })), "data");
  await provider.remove(folder, { id: "A" });
  assert.equal(fetch.calls[1].method, "DELETE");
});

test("ensureFolder finds an existing folder or creates one inside the parent", async () => {
  const { provider, fetch } = make([
    { match: "/drive/v3/files?", method: "GET", reply: ({ url }) => ({ json: { files: new URL(url).searchParams.get("q").includes("'quiz'") ? [] : [{ id: "K", name: "karaoke" }] } }) },
    { match: "/drive/v3/files?supportsAllDrives", method: "POST", reply: { json: { id: "Q", name: "quiz" } } },
  ]);
  assert.equal((await provider.ensureFolder(folder, "karaoke")).id, "K");
  assert.equal((await provider.ensureFolder(folder, "quiz")).id, "Q");
  const post = fetch.calls.find((c) => c.method === "POST");
  assert.deepEqual(JSON.parse(post.body), { name: "quiz", mimeType: "application/vnd.google-apps.folder", parents: ["F1"] });
});

test("access reports owner, editor or viewer", async () => {
  for (const [file, expected] of [[{ ownedByMe: true }, "owner"], [{ ownedByMe: false, capabilities: { canAddChildren: true } }, "editor"], [{ ownedByMe: false, capabilities: { canAddChildren: false } }, "viewer"]]) {
    const { provider } = make([{ match: "/files/F1?", reply: { json: file } }]);
    assert.equal(await provider.access(folder), expected);
  }
});

test("share maps roles; shareWithLink makes the folder readable by anyone with the link", async () => {
  const { provider, fetch } = make([{ match: "/permissions", reply: { json: { id: "p" } } }]);
  await provider.share(folder, "a@b.c", "viewer");
  assert.deepEqual(JSON.parse(fetch.calls[0].body), { type: "user", role: "reader", emailAddress: "a@b.c" });
  await provider.share(folder, "a@b.c");
  assert.equal(JSON.parse(fetch.calls[1].body).role, "writer");
  assert.equal(await provider.shareWithLink(folder), "https://drive.google.com/drive/folders/F1");
  assert.deepEqual(JSON.parse(fetch.calls[2].body), { type: "anyone", role: "reader" });
});

test("a refused change to a folder with other people's files is a forbidden error", async () => {
  const { provider } = make([{ match: "/permissions", reply: { status: 403, json: { error: { message: "The user has not granted the app write access to the child file", errors: [{ reason: "appNotAuthorizedToChild" }] } } } }]);
  await assert.rejects(provider.share(folder, "a@b.c"), (e) => e.kind === ErrorKind.forbidden && /appNotAuthorizedToChild/.test(e.message));
});

test("the settings pointer lives in the hidden app-data space", async () => {
  let stored;
  const { provider, fetch } = make([
    { match: "spaces=appDataFolder", reply: () => ({ json: { files: stored ? [{ id: "P", name: "pbe-pointer.json" }] : [] } }) },
    { match: "uploadType=multipart", method: "POST", reply: ({ body }) => { stored = true; return { json: { id: "P" } }; } },
    { match: "/files/P?uploadType=media", method: "PATCH", reply: { json: { id: "P" } } },
    { match: "/files/P?alt=media", reply: { json: { folder: { id: "F1" } } } },
  ]);
  assert.equal(await provider.readPointer(), undefined);
  await provider.writePointer({ folder: { id: "F1" } });
  assert.deepEqual(await provider.readPointer(), { folder: { id: "F1" } });
  await provider.writePointer({ folder: { id: "F2" } });
  assert.equal(fetch.calls.at(-1).method, "PATCH");
  const create = fetch.calls.find((c) => c.method === "POST");
  assert.ok(text(new Uint8Array(await create.body.arrayBuffer())).includes('"parents":["appDataFolder"]'));
});

test("GooglePublicReader reads with an API key and no sign-in, and cannot write", async () => {
  const fetch = fakeFetch([
    { match: "/drive/v3/files?", reply: { json: { files: [{ id: "A", name: "playlists.json", md5Checksum: "m" }] } } },
    { match: "alt=media", reply: { bytes: "public" } },
  ]);
  const reader = new GooglePublicReader({ apiKey: "KEY", fetch, sleep: noSleep });
  const [entry] = await reader.list(folder);
  assert.equal(text(await reader.read(folder, entry)), "public");
  for (const c of fetch.calls) {
    assert.equal(c.headers.get("authorization"), null);
    assert.ok(c.url.includes("key=KEY"));
  }
  assert.equal(await reader.access(), "viewer");
  await assert.rejects(reader.write(folder, "x", bytes("x")), (e) => e.kind === ErrorKind.forbidden);
});
