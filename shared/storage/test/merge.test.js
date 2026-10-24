import test from "node:test";
import assert from "node:assert/strict";
import { mergeRecords, mergeStamped, mergeStampedMap, pruneTombstones, unionBy } from "../merge.js";
import { stableStringify } from "../envelope.js";

const rec = (id, updatedAt, extra = {}) => ({ id, updatedAt, createdAt: Number(id.slice(1)), ...extra });

test("mergeRecords: newer record wins; records from both sides are kept", () => {
  const a = [rec("p1", 5, { name: "old" }), rec("p2", 1)];
  const b = [rec("p1", 9, { name: "new" }), rec("p3", 2)];
  const m = mergeRecords(a, b);
  assert.deepEqual(m.map((r) => r.id), ["p1", "p2", "p3"]);
  assert.equal(m[0].name, "new");
});

test("mergeRecords: a newer tombstone beats an older edit, and a newer edit resurrects", () => {
  const edit = rec("p1", 5, { name: "x" });
  const tomb = rec("p1", 8, { deleted: true });
  assert.equal(mergeRecords([edit], [tomb])[0].deleted, true);
  assert.equal(mergeRecords([tomb], [rec("p1", 9, { name: "back" })])[0].name, "back");
});

test("mergeRecords: exact stamp ties resolve the same way in both directions", () => {
  const a = [rec("p1", 5, { name: "A" })];
  const b = [rec("p1", 5, { name: "B" })];
  assert.equal(stableStringify(mergeRecords(a, b)), stableStringify(mergeRecords(b, a)));
});

test("mergeRecords is commutative, associative and idempotent on random data", () => {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const make = () => Array.from({ length: rnd(6) }, () => rec(`p${rnd(5) + 1}`, rnd(10), { name: `n${rnd(4)}`, deleted: rnd(4) === 0 }));
  const same = (x, y) => assert.equal(stableStringify(x), stableStringify(y));
  for (let i = 0; i < 200; i++) {
    const a = make(), b = make(), c = make();
    same(mergeRecords(a, b), mergeRecords(b, a));
    same(mergeRecords(mergeRecords(a, b), c), mergeRecords(a, mergeRecords(b, c)));
    same(mergeRecords(a, a), mergeRecords(a, []));
    const ab = mergeRecords(a, b);
    same(mergeRecords(ab, ab), ab);
  }
});

test("mergeRecords skips malformed entries and honours a custom sort", () => {
  const m = mergeRecords([null, { noid: 1 }, rec("p1", 1)], [rec("p2", 1)], { sort: (x, y) => y.id.localeCompare(x.id) });
  assert.deepEqual(m.map((r) => r.id), ["p2", "p1"]);
});

test("mergeStamped and mergeStampedMap are last-writer-wins per key", () => {
  assert.deepEqual(mergeStamped({ v: 1, t: 5 }, { v: 2, t: 9 }), { v: 2, t: 9 });
  assert.deepEqual(mergeStamped(undefined, { v: 2, t: 9 }), { v: 2, t: 9 });
  const m = mergeStampedMap({ a: { v: 1, t: 5 }, b: { v: 1, t: 1 } }, { a: { v: 2, t: 3 }, c: { v: 3, t: 1 } });
  assert.deepEqual(m, { a: { v: 1, t: 5 }, b: { v: 1, t: 1 }, c: { v: 3, t: 1 } });
  assert.equal(stableStringify(mergeStampedMap({ a: { v: 1, t: 5 } }, { a: { v: 2, t: 5 } })), stableStringify(mergeStampedMap({ a: { v: 2, t: 5 } }, { a: { v: 1, t: 5 } })));
});

test("unionBy keeps one copy of each immutable item, in a stable order", () => {
  const a = [{ id: "x2", n: 1 }, { id: "x1", n: 1 }];
  const b = [{ id: "x1", n: 1 }, { id: "x3", n: 1 }];
  assert.deepEqual(unionBy(a, b, (i) => i.id).map((i) => i.id), ["x1", "x2", "x3"]);
  assert.deepEqual(unionBy(b, a, (i) => i.id).map((i) => i.id), ["x1", "x2", "x3"]);
});

test("pruneTombstones removes only old deletions", () => {
  const rs = [rec("p1", 10, { deleted: true }), rec("p2", 90, { deleted: true }), rec("p3", 5)];
  assert.deepEqual(pruneTombstones(rs, 100, 50).map((r) => r.id), ["p2", "p3"]);
});
