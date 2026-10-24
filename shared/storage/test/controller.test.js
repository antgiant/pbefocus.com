import test from "node:test";
import assert from "node:assert/strict";
import { SyncController } from "../sync/controller.js";

function fakeTimers() {
  const q = [];
  let id = 0;
  return {
    q,
    setTimeout: (fn, ms) => { const t = { id: ++id, fn, ms }; q.push(t); return t.id; },
    clearTimeout: (h) => { const i = q.findIndex((t) => t.id === h); if (i >= 0) q.splice(i, 1); },
    next() { return q.shift(); },
  };
}
const flush = () => new Promise((r) => setImmediate(r));

test("start runs immediately, then polls at the poll interval", async () => {
  const timers = fakeTimers();
  let runs = 0;
  const c = new SyncController({ run: async () => { runs++; }, timers, pollMs: 60000, now: () => 5 });
  c.start();
  assert.equal(timers.q[0].ms, 0);
  timers.next().fn(); await flush();
  assert.equal(runs, 1);
  assert.equal(c.state.status, "idle");
  assert.equal(c.state.lastSyncedAt, 5);
  assert.equal(timers.q[0].ms, 60000);
});

test("request debounces bursts into one scheduled run", async () => {
  const timers = fakeTimers();
  const c = new SyncController({ run: async () => {}, timers, debounceMs: 2000 });
  c.start();
  timers.next().fn(); await flush();
  c.request(); c.request(); c.request();
  assert.equal(timers.q.length, 1);
  assert.equal(timers.q[0].ms, 2000);
});

test("failures back off exponentially up to a cap, and success resets", async () => {
  const timers = fakeTimers();
  let fail = true;
  const c = new SyncController({ run: async () => { if (fail) throw new Error("offline"); }, timers, minBackoffMs: 5000, maxBackoffMs: 30000, pollMs: 60000 });
  c.start();
  const delays = [];
  for (let i = 0; i < 5; i++) { timers.next().fn(); await flush(); delays.push(timers.q[0].ms); }
  assert.deepEqual(delays, [5000, 10000, 20000, 30000, 30000]);
  assert.equal(c.state.status, "error");
  assert.equal(c.state.failures, 5);
  fail = false;
  timers.next().fn(); await flush();
  assert.equal(c.state.status, "idle");
  assert.equal(c.state.failures, 0);
  assert.equal(timers.q[0].ms, 60000);
});

test("a request during a run triggers one more run right after", async () => {
  const timers = fakeTimers();
  let release; let runs = 0;
  const c = new SyncController({ run: () => { runs++; return new Promise((r) => { release = r; }); }, timers });
  c.start();
  timers.next().fn(); await flush();
  c.request(); c.request();
  assert.equal(runs, 1);
  release(); await flush();
  assert.equal(timers.q[0].ms, 0);
  timers.next().fn(); await flush();
  assert.equal(runs, 2);
});

test("stop cancels timers and later requests do nothing", async () => {
  const timers = fakeTimers();
  const c = new SyncController({ run: async () => {}, timers });
  c.start();
  c.stop();
  assert.equal(timers.q.length, 0);
  c.request();
  assert.equal(timers.q.length, 0);
});

test("status changes are reported", async () => {
  const timers = fakeTimers();
  const seen = [];
  const c = new SyncController({ run: async () => {}, timers, onStatus: (s) => seen.push(s.status) });
  c.start();
  timers.next().fn(); await flush();
  assert.deepEqual(seen, ["syncing", "idle"]);
});
