// test/liveCatalogue.test.js  -  esegui con: node --test test/liveCatalogue.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const live = require("../Stripe/js/liveCatalogue.js");
const money = require("../Stripe/js/money.js");
const cart = require("../Stripe/js/cart.js");

const payload = (items, extra) => Object.assign({ version: 1, source: "sheet", items }, extra);
const okFetch = (body) => async () => ({ ok: true, status: 200, json: async () => body });
const quiet = async (fn) => {
  const w = console.warn; console.warn = () => {};
  try { return await fn(); } finally { console.warn = w; }
};
const row = (id, extra) => Object.assign({
  id, name_it: "Vaso " + id, long_it: "descrizione", price_old: "150", price_new: "120", price_new__raw: 120, venduto: ""
}, extra);

test("fetchLive: valid payload becomes a Map, bad entries ignored", async () => {
  const map = await live.fetchLive(okFetch(payload([
    { id: "v1", priceCents: 12000, sold: false },
    { id: "v2", priceCents: 9050, sold: true },
    { id: "bad id", priceCents: 100, sold: false },
    { id: "v3", priceCents: 0, sold: false },
    { id: "v4", priceCents: 12.5, sold: false },
    { id: "v5", priceCents: "100", sold: false },
    { id: "v6", priceCents: 100, sold: "no" },
    { id: 7, priceCents: 100, sold: false },
    null, "x"
  ])), "https://x/c");
  assert.deepEqual([...map.keys()], ["v1", "v2"]);
  assert.deepEqual(map.get("v2"), { priceCents: 9050, sold: true });
});

test("fetchLive: wrong version / shape / HTTP error / throw -> empty Map", async () => {
  const bodies = [payload([], { version: 2 }), { version: 1, items: "x" }, null, "str", {}];
  for (const b of bodies) assert.equal((await quiet(() => live.fetchLive(okFetch(b), "u"))).size, 0);
  const http = async () => ({ ok: false, status: 503, json: async () => ({}) });
  assert.equal((await quiet(() => live.fetchLive(http, "u"))).size, 0);
  const boom = async () => { throw new Error("net"); };
  assert.equal((await quiet(() => live.fetchLive(boom, "u"))).size, 0);
  const badJson = async () => ({ ok: true, json: async () => { throw new Error("json"); } });
  assert.equal((await quiet(() => live.fetchLive(badJson, "u"))).size, 0);
  assert.equal((await quiet(() => live.fetchLive(null, "u"))).size, 0);
  assert.equal((await quiet(() => live.fetchLive(boom, ""))).size, 0);
});

test("fetchLive: times out on a hanging fetch", async () => {
  let aborted = false;
  const hang = (url, opts) => new Promise((_, rej) => {
    opts.signal.addEventListener("abort", () => { aborted = true; rej(new Error("aborted")); });
  });
  const t0 = Date.now();
  const map = await quiet(() => live.fetchLive(hang, "u", 50));
  assert.equal(map.size, 0);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(aborted, true);
});

test("applyOverlay: updates price and sold only for matching ids, leaves the rest", () => {
  const rows = [row("a"), row("b"), row("c")];
  const map = new Map([["a", { priceCents: 9950, sold: false }], ["zzz", { priceCents: 100, sold: true }]]);
  const out = live.applyOverlay(rows, map);
  assert.equal(out.length, 3);
  assert.equal(money.cellToCents(out[0], "price_new"), 9950);
  assert.equal(out[1], rows[1]);
  assert.equal(out[2], rows[2]);
  assert.equal(out.find((r) => r.id === "zzz"), undefined);
  assert.equal(rows[0].price_new, "120");   // input non mutato
});

test("applyOverlay: never changes id/images/descriptions/old price", () => {
  const r = row("a", { img1: "x.jpg", long_en: "desc" });
  const [o] = live.applyOverlay([r], new Map([["a", { priceCents: 5000, sold: true }]]));
  for (const k of ["id", "name_it", "long_it", "long_en", "img1", "price_old"]) assert.equal(o[k], r[k], k);
});

test("applyOverlay: sold authority - live wins when present, ODS otherwise", () => {
  const sold = (r) => require("../Stripe/js/util.js").isSoldFlag(r.venduto);
  const rows = [row("s", { venduto: "si" }), row("f", { venduto: "" }), row("n", { venduto: "si" })];
  const out = live.applyOverlay(rows, new Map([
    ["s", { priceCents: 100, sold: false }],   // la proprietaria rimette in vendita
    ["f", { priceCents: 100, sold: true }]     // venduto nel foglio
  ]));
  assert.equal(sold(out[0]), false);
  assert.equal(sold(out[1]), true);
  assert.equal(sold(out[2]), true);            // nessun dato live: vale l'ODS
});

test("applyOverlay: empty/invalid map returns rows unchanged", () => {
  const rows = [row("a")];
  assert.equal(live.applyOverlay(rows, new Map()), rows);
  assert.equal(live.applyOverlay(rows, null), rows);
  assert.deepEqual(live.applyOverlay(null, new Map([["a", { priceCents: 1, sold: false }]])), []);
});

test("price units: overlay roundtrips cents through money.js (no float drift)", () => {
  for (const cents of [1, 99, 12000, 12050, 1999, 100005, 9999999]) {
    const [o] = live.applyOverlay([row("a")], new Map([["a", { priceCents: cents, sold: false }]]));
    assert.equal(money.cellToCents(o, "price_new"), cents);
    assert.equal(money.parseEuroToCents(o.price_new), cents);   // anche il testo "it" e' coerente
  }
});

test("cart reconcile: overlaid sold removes the line, overlaid price updates it", () => {
  const prods = { a: { id: "a", type: "physical", priceCents: 9950, sold: false }, b: { id: "b", type: "physical", priceCents: 5000, sold: true } };
  const ln = (id, amt) => ({ id, type: "physical", quantity: 1, name: "n", currency: "eur", unit_amount: amt, image: "" });
  const r = cart.reconcile([ln("a", 12000), ln("b", 5000)], prods, {});
  assert.equal(r.removed, 1);
  assert.equal(r.cart.length, 1);
  assert.equal(r.cart[0].unit_amount, 9950);
});
