import test from "node:test";
import assert from "node:assert/strict";
import { EnvelopeError, decodeEnvelope, encodeEnvelope, getDeviceId, makeEnvelope, stableStringify } from "../envelope.js";

const env = () => makeEnvelope({ app: "karaoke", kind: "state", schema: 2, deviceId: "dev12345", updatedAt: 5, data: { a: [1, { b: 2 }] } });

test("encode and decode round-trip", () => {
  assert.deepEqual(decodeEnvelope(encodeEnvelope(env())), env());
});

test("decode rejects anything that is not a valid envelope", () => {
  const enc = (v) => new TextEncoder().encode(typeof v === "string" ? v : JSON.stringify(v));
  for (const bad of ["not json", "[]", "null", { format: "other" }, { ...env(), app: "" }, { ...env(), schema: 0 }, { ...env(), updatedAt: "x" }, { ...env(), deviceId: undefined }]) {
    assert.throws(() => decodeEnvelope(enc(bad)), EnvelopeError);
  }
  const noData = { ...env() }; delete noData.data;
  assert.throws(() => decodeEnvelope(enc(noData)), EnvelopeError);
});

test("stableStringify ignores key order and undefined properties", () => {
  assert.equal(stableStringify({ b: 1, a: { d: [3, 2], c: undefined } }), stableStringify({ a: { c: undefined, d: [3, 2] }, b: 1 }));
  assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]));
  assert.equal(stableStringify(undefined), "null");
});

test("getDeviceId is stable, valid, and survives blocked storage", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const a = getDeviceId(storage);
  assert.match(a, /^[a-z0-9]{6,16}$/);
  assert.equal(getDeviceId(storage), a);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.match(getDeviceId(blocked), /^[a-z0-9]{6,16}$/);
  assert.match(getDeviceId(null), /^[a-z0-9]{6,16}$/);
});
