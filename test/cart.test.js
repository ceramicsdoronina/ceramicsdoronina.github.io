// test/cart.test.js  -  esegui con: node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const cart = require("../Stripe/js/cart.js");

const vase = (id, extra) => Object.assign({
  id, type: "physical", priceCents: 12000, titles: { it: "Vaso " + id, en: "Vase " + id, ru: "Ваза " + id }, img: "images/catalogue/x.jpg", maxQty: 1
}, extra);
const mc = (id, extra) => Object.assign({
  id, type: "digital", priceCents: 9000, titles: { it: "MC " + id }, img: "images/masterclass/x.jpg", maxQty: 4
}, extra);
const line = (id, extra) => Object.assign({ id, type: "physical", quantity: 1, name: "Vaso " + id, currency: "eur", unit_amount: 12000, image: "" }, extra);

test("mergeAdd: first add of a vase, repeat add is ignored", () => {
  const p = vase("v1");
  const a = cart.mergeAdd([], p, 1);
  assert.equal(a.status, "added");
  assert.equal(a.cart.length, 1);
  assert.equal(a.cart[0].quantity, 1);
  assert.equal(a.cart[0].unit_amount, 12000);
  const b = cart.mergeAdd(a.cart, p, 1);
  assert.equal(b.status, "already");
  assert.equal(b.cart[0].quantity, 1);
  const c = cart.mergeAdd(a.cart, p, 5);
  assert.equal(c.status, "already");
  assert.equal(c.cart[0].quantity, 1);
});

test("mergeAdd: digital items accumulate up to maxQty", () => {
  const p = mc("mc1");
  let r = cart.mergeAdd([], p, 1);
  r = cart.mergeAdd(r.cart, p, 2);
  assert.equal(r.status, "added");
  assert.equal(r.cart[0].quantity, 3);
  r = cart.mergeAdd(r.cart, p, 5);
  assert.equal(r.cart[0].quantity, 4);
  r = cart.mergeAdd(r.cart, p, 1);
  assert.equal(r.status, "max");
  assert.equal(r.cart[0].quantity, 4);
  // first add is clamped too
  assert.equal(cart.mergeAdd([], p, 99).cart[0].quantity, 4);
  // default digital max (6) when maxQty is missing
  assert.equal(cart.mergeAdd([], mc("mc2", { maxQty: undefined }), 99).cart[0].quantity, 6);
});

test("mergeAdd: sold / invalid price / invalid id are rejected and the input is not mutated", () => {
  const base = [line("v9")];
  const snapshot = JSON.stringify(base);
  assert.equal(cart.mergeAdd(base, vase("v1", { sold: true }), 1).status, "invalid");
  assert.equal(cart.mergeAdd(base, vase("v1", { priceCents: 0 }), 1).status, "invalid");
  assert.equal(cart.mergeAdd(base, vase("v1", { priceCents: 12.5 }), 1).status, "invalid");
  assert.equal(cart.mergeAdd(base, vase("v1", { priceCents: null }), 1).status, "invalid");
  assert.equal(cart.mergeAdd(base, vase("bad id"), 1).status, "invalid");
  assert.equal(cart.mergeAdd(base, null, 1).status, "invalid");
  cart.mergeAdd(base, mc("mc1"), 2);
  assert.equal(JSON.stringify(base), snapshot);
});

test("sanitizeLine / sanitizeCart", () => {
  assert.equal(cart.sanitizeLine(null), null);
  assert.equal(cart.sanitizeLine({ id: "bad id", quantity: 1 }), null);
  assert.equal(cart.sanitizeLine({ id: "v1", quantity: 0 }), null);
  assert.equal(cart.sanitizeLine({ id: "v1", quantity: 1.5 }), null);
  const l = cart.sanitizeLine({ id: " v1 ", quantity: 500, unit_amount: -3, image: "javascript:alert(1)", type: "weird" });
  assert.equal(l.id, "v1");
  assert.equal(l.quantity, 99);
  assert.equal(l.unit_amount, 0);
  assert.equal(l.image, "");
  assert.equal(l.type, "physical");
  const res = cart.sanitizeCart([line("v1"), line("v1"), { id: "x y", quantity: 1 }, "junk", line("v2")]);
  assert.deepEqual(res.cart.map((x) => x.id), ["v1", "v2"]);
  assert.equal(res.dropped, 3);
  assert.deepEqual(cart.sanitizeCart("nope"), { cart: [], dropped: 0 });
});

test("reconcile: drops unknown / sold / wrong type / invalid price; clamps quantity", () => {
  const products = {
    v1: vase("v1"),
    v2: vase("v2", { sold: true }),
    v3: vase("v3", { priceCents: null }),
    v4: vase("v4", { type: "digital" }),          // la riga e' physical: tipo diverso
    mc1: mc("mc1", { maxQty: 2 })
  };
  const input = [
    line("v1"), line("v2"), line("v3"), line("v4"), line("ghost"),
    line("mc1", { type: "digital", quantity: 9, unit_amount: 9000, name: "MC mc1" })
  ];
  const r = cart.reconcile(input, products);
  assert.deepEqual(r.cart.map((x) => x.id), ["v1", "mc1"]);
  assert.equal(r.removed, 4);
  assert.equal(r.changed, true);
  assert.equal(r.cart.find((x) => x.id === "mc1").quantity, 2);
  assert.equal(input.length, 6, "input not mutated");
});

test("reconcile: refreshes name and price, reports unchanged when nothing differs", () => {
  const products = { v1: vase("v1", { priceCents: 15000 }) };
  const r = cart.reconcile([line("v1")], products);
  assert.equal(r.cart[0].unit_amount, 15000);
  assert.equal(r.changed, true);
  const same = cart.reconcile([line("v1", { unit_amount: 15000 })], products);
  assert.equal(same.changed, false);
  assert.equal(same.removed, 0);
});

test("reconcile: physicalKnown / digitalKnown false leaves that type alone", () => {
  const input = [line("v1"), line("mc1", { type: "digital", quantity: 3, name: "x", unit_amount: 1 })];
  // registro vuoto: tutto sarebbe sconosciuto
  const onlyDigitalKnown = cart.reconcile(input, {}, { physicalKnown: false });
  assert.deepEqual(onlyDigitalKnown.cart.map((x) => x.id), ["v1"]);
  assert.equal(onlyDigitalKnown.removed, 1);
  const onlyPhysicalKnown = cart.reconcile(input, {}, { digitalKnown: false });
  assert.deepEqual(onlyPhysicalKnown.cart.map((x) => x.id), ["mc1"]);
  const noneKnown = cart.reconcile(input, {}, { physicalKnown: false, digitalKnown: false });
  assert.deepEqual(noneKnown.cart, input);
  assert.equal(noneKnown.removed, 0);
  assert.equal(noneKnown.changed, false);
});

test("pending map: normalise, add with 24 h pruning", () => {
  const now = 1_700_000_000_000;
  assert.deepEqual(cart.normalizePending(null), {});
  assert.deepEqual(cart.normalizePending([]), {});
  assert.deepEqual(cart.normalizePending("x"), {});
  // vecchio formato a slot singolo
  assert.deepEqual(cart.normalizePending({ session_id: "cs_old", ids: ["v1"], ts: 5 }), { cs_old: { ids: ["v1"], ts: 5 } });
  // voci malformate scartate
  assert.deepEqual(cart.normalizePending({ a: { ids: ["v1"], ts: 1 }, b: 7, c: { ids: "no" } }), { a: { ids: ["v1"], ts: 0 + 1 } });

  const old = { cs_old: { ids: ["v1"], ts: now - cart.PENDING_TTL_MS - 1 }, cs_recent: { ids: ["v2"], ts: now - 1000 } };
  const m = cart.addPending(old, "cs_new", ["v3", "v4"], now);
  assert.deepEqual(Object.keys(m).sort(), ["cs_new", "cs_recent"]);
  assert.deepEqual(m.cs_new, { ids: ["v3", "v4"], ts: now });
  assert.ok(old.cs_old, "input not mutated");
});

test("pendingAfterSuccess: clears only the matching session's ids and entry", () => {
  const c = [line("v1"), line("v2"), line("v3")];
  const map = { cs_a: { ids: ["v1", "v2"], ts: 1 }, cs_b: { ids: ["v3"], ts: 2 } };
  const r = cart.pendingAfterSuccess(map, "cs_a", c);
  assert.equal(r.matched, true);
  assert.deepEqual(r.cart.map((x) => x.id), ["v3"]);
  assert.deepEqual(Object.keys(r.map), ["cs_b"], "other pending entries survive");
  assert.deepEqual(map.cs_a.ids, ["v1", "v2"], "input not mutated");
  assert.equal(c.length, 3);
});

test("pendingAfterSuccess: non-matching or missing session id changes nothing", () => {
  const c = [line("v1")];
  const map = { cs_a: { ids: ["v1"], ts: 1 } };
  for (const sid of ["cs_other", "", null, undefined, 42, "__proto__", "toString", "constructor"]) {
    const r = cart.pendingAfterSuccess(map, sid, c);
    assert.equal(r.matched, false, String(sid));
    assert.equal(r.cart, c);
    assert.equal(r.map, map);
  }
  // mappa vuota
  assert.equal(cart.pendingAfterSuccess({}, "cs_a", c).matched, false);
});

test("removeLine / removeIds", () => {
  const c = [line("v1"), line("v2")];
  assert.deepEqual(cart.removeLine(c, "v1").map((x) => x.id), ["v2"]);
  assert.deepEqual(cart.removeLine(c, "zz").length, 2);
  assert.deepEqual(cart.removeIds(c, ["v1", "v2"]), []);
});

test("isStripeUrl: only https://checkout.stripe.com, lookalike hosts rejected", () => {
  assert.equal(cart.isStripeUrl("https://checkout.stripe.com/c/pay/cs_test_abc#frag"), true);
  const bad = [
    "http://checkout.stripe.com/c/pay/x",
    "https://checkout.stripe.com.evil.com/c/pay/x",
    "https://evilcheckout.stripe.com/x",
    "https://checkout.stripe.com@evil.com/x",
    "https://checkout.stripe.com:8443/x",
    "https://user:pw@checkout.stripe.com/x",
    "https://checkout-stripe.com/x",
    "https://stripe.com/x",
    "https://checkout.stripe.com.evil.com",
    "//checkout.stripe.com/x",
    "javascript:alert(1)",
    "", null, undefined, 5, {}
  ];
  for (const u of bad) assert.equal(cart.isStripeUrl(u), false, String(u));
});
