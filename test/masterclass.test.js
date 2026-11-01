// test/masterclass.test.js  -  prenotazione masterclass per persone: prezzi a gruppo, posti, carrello,
// righe legacy, titoli con fallback, plurali, escape. Esegui con: node --test test/masterclass.test.js
//
// Fixture: test/fixtures/catalogue-tab-Masterclass-v2.csv (schema nuovo, righe reali) e
// catalogue-tab-Masterclass.csv (legacy: spots / price).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

globalThis.window = globalThis;
require("../messages.js");
require("../i18n.js");
const util = require("../Stripe/js/util.js");
const money = require("../Stripe/js/money.js");
const live = require("../Stripe/js/liveCatalogue.js");
const cart = require("../Stripe/js/cart.js");
const messages = globalThis.window.messages;

const FIX = path.join(__dirname, "fixtures");
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); if (row.some((x) => x !== "")) rows.push(row); }
  return rows;
}
function csvTab(file) {
  const [headers, ...body] = parseCsv(fs.readFileSync(path.join(FIX, file), "utf8"));
  return { headers, rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] == null ? "" : r[i]]))) };
}
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const sheetRows = (file) => quiet(() => live.parseTab("masterclass", csvTab(file)));

// riga schema nuovo: prezzi per gruppo come mappa {N: euro}
const row = (id, o) => {
  const r = Object.assign({ id, name_it: "MC " + id, date: "01.01.2099", time: "10:00", level: "x", seats_total: "8", seats_booked: "0", img1: "" }, o);
  for (let n = 1; n <= 8; n++) if (!(("price_" + n) in r)) r["price_" + n] = "";
  return r;
};
const TIERS = { price_1: "100", price_2: "180", price_3: "255", price_4: "320", price_5: "375", price_6: "420", price_7: "455", price_8: "480" };
// prodotto di registro dalla riga, come lo registra masterclass.js
function product(r) {
  const b = util.bookingFromRow(r);
  return { id: r.id, type: "digital", sold: b.sold, titles: { it: r.name_it }, priceCents: b.priceCents, tiersCents: b.tiersCents, maxQty: b.maxQty, img: "images/masterclass/x.jpg" };
}
const reg = (...ps) => Object.fromEntries(ps.map((p) => [p.id, p]));

// ── dati reali (fixture) ──
test("v2 fixture rows pass through the endpoint tab parser and give the 1/2-person tiers", () => {
  const rows = sheetRows("catalogue-tab-Masterclass-v2.csv");
  assert.equal(rows.length, 6);
  for (const r of rows) {
    const b = util.bookingFromRow(r);
    assert.deepEqual(b.tiersCents, [10000, 18000, null, null, null, null, null, null]);
    assert.equal(b.legacy, false);
    assert.equal(b.seatsTotal, 8);
    assert.equal(b.seatsBooked, 0);
    assert.equal(b.seatsFree, 8);
    assert.equal(b.maxQty, 2);           // min(8, 8 liberi, gruppo piu' grande offerto = 2)
    assert.equal(b.priceCents, 10000);
    assert.equal(b.sold, false);
    assert.deepEqual(cart.offeredPersons(product(r)), [1, 2]);
  }
});

test("legacy fixture rows (spots / price): linear tiers, seats from the digits of spots, no tracking", () => {
  const rows = sheetRows("catalogue-tab-Masterclass.csv");
  assert.equal(rows.length, 6);
  for (const r of rows) {
    const b = util.bookingFromRow(r);
    assert.equal(b.legacy, true);
    assert.deepEqual(b.tiersCents, [10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000]);
    assert.equal(b.seatsTotal, 6);
    assert.equal(b.seatsFree, 6);
    assert.equal(b.maxQty, 6);
    assert.equal(b.priceCents, 10000);
    assert.deepEqual(cart.offeredPersons(product(r)), [1, 2, 3, 4, 5, 6]);
  }
});

test("legacy row without a usable spots number defaults to 6 seats; bad price = not bookable", () => {
  assert.equal(util.bookingFromRow({ id: "a", price: "90", spots: "pochi" }).seatsTotal, 6);
  assert.equal(util.bookingFromRow({ id: "a", price: "90", spots: "Max 12 persone" }).maxQty, 8);   // tetto 8
  const bad = util.bookingFromRow({ id: "a", price: "-", spots: "Max 4" });
  assert.equal(bad.maxQty, 0);
  assert.equal(bad.sold, true);
  assert.equal(bad.priceCents, null);
});

test("endpoint tab validation accepts the new schema (price_1) and the legacy one (price), not neither", () => {
  assert.ok(live.parseTab("masterclass", csvTab("catalogue-tab-Masterclass-v2.csv")));
  const noPrice = csvTab("catalogue-tab-Masterclass.csv");
  noPrice.headers = noPrice.headers.filter((h) => h !== "price");
  assert.equal(quiet(() => live.parseTab("masterclass", noPrice)), null);
});

// ── tiers e posti ──
test("tiers are taken from the sheet, never computed linearly; gaps stay null", () => {
  const b = util.bookingFromRow(row("m", { price_1: "100", price_2: "180", price_4: "320" }));
  assert.deepEqual(b.tiersCents, [10000, 18000, null, 32000, null, null, null, null]);
  assert.equal(b.maxQty, 4);
  assert.deepEqual(cart.offeredPersons(product(row("m", { price_1: "100", price_2: "180", price_4: "320" }))), [1, 2, 4]);
  // solo gruppi >= 2: priceCents = il piu' economico offerto
  assert.equal(util.bookingFromRow(row("m", { price_2: "180", price_3: "250" })).priceCents, 18000);
});

test("seats: 8 booked of 8 = 0 free and sold; 2 booked = 6 free; cap = min(8, free, highest offered)", () => {
  const full = util.bookingFromRow(row("m", Object.assign({ seats_booked: "8" }, TIERS)));
  assert.equal(full.seatsFree, 0);
  assert.equal(full.maxQty, 0);
  assert.equal(full.sold, true);
  const two = util.bookingFromRow(row("m", Object.assign({ seats_booked: "2" }, TIERS)));
  assert.equal(two.seatsFree, 6);
  assert.equal(two.maxQty, 6);
  const small = util.bookingFromRow(row("m", { seats_total: "4", seats_booked: "1", price_1: "100", price_2: "180", price_3: "250" }));
  assert.equal(small.seatsFree, 3);
  assert.equal(small.maxQty, 3);
  // piu' posti che gruppi offerti
  assert.equal(util.bookingFromRow(row("m", { price_1: "100", price_2: "180" })).maxQty, 2);
  // booked > total non da' negativi
  assert.equal(util.bookingFromRow(row("m", Object.assign({ seats_total: "4", seats_booked: "9" }, TIERS))).seatsFree, 0);
});

test("seats_free from the sheet: the smaller of it and total - booked wins (never oversell)", () => {
  assert.equal(util.bookingFromRow(row("m", Object.assign({ seats_booked: "2", seats_free: "3" }, TIERS))).seatsFree, 3);
  assert.equal(util.bookingFromRow(row("m", Object.assign({ seats_booked: "2", seats_free: "7" }, TIERS))).seatsFree, 6);
  assert.equal(util.bookingFromRow(row("m", Object.assign({ seats_booked: "2", seats_free: "" }, TIERS))).seatsFree, 6);
  // seats_total vuoto: 8
  assert.equal(util.bookingFromRow(row("m", Object.assign({ seats_total: "" }, TIERS))).seatsTotal, 8);
});

test("selector bounds: 1..min(8, seatsFree, highest offered), only offered group sizes, none when sold", () => {
  const offered = (o) => cart.offeredPersons(product(row("m", o)));
  assert.deepEqual(offered(TIERS), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(offered(Object.assign({ seats_booked: "5" }, TIERS)), [1, 2, 3]);
  assert.deepEqual(offered(Object.assign({ seats_booked: "7" }, TIERS)), [1]);
  assert.deepEqual(offered(Object.assign({ seats_booked: "8" }, TIERS)), []);
  assert.deepEqual(offered({ price_1: "100", price_2: "180" }), [1, 2]);
  assert.deepEqual(offered({ price_2: "180", price_3: "250" }), [2, 3]);
  assert.deepEqual(offered({}), []);
  assert.deepEqual(cart.offeredPersons(Object.assign(product(row("m", TIERS)), { sold: true })), []);
});

// ── carrello: totali = quelli del server ──
test("cart totals use the tier of N, one line per booking: N=1, 2, 8", () => {
  const p = product(row("m1", TIERS));
  const total = (n) => {
    const r = cart.mergeAdd([], p, n);
    assert.equal(r.status, "added");
    assert.equal(r.cart.length, 1);
    assert.equal(r.cart[0].quantity, n);
    return cart.cartTotalCents(r.cart, reg(p));
  };
  assert.equal(total(1), 10000);
  assert.equal(total(2), 18000);     // non 2 x 100
  assert.equal(total(8), 48000);     // non 8 x 100
  assert.equal(cart.lineTotalCents({ id: "m1", quantity: 3 }, p), 25500);
});

test("missing tier: that group size is not bookable, adds fall to the nearest offered size below", () => {
  const p = product(row("m1", { price_1: "100", price_2: "180", price_4: "320" }));   // niente gruppo da 3
  assert.equal(cart.lineTotalCents({ id: "m1", quantity: 3 }, p), null);
  assert.equal(cart.mergeAdd([], p, 3).cart[0].quantity, 2);
  assert.equal(cart.mergeAdd([], p, 4).cart[0].quantity, 4);
  assert.equal(cart.mergeAdd([], p, 99).cart[0].quantity, 4);
  assert.equal(cart.setPersons([cart.mergeAdd([], p, 1).cart[0]], p, "m1", 3).status, "invalid");
  // senza gruppo da 1 persona
  const only2 = product(row("m2", { price_2: "180" }));
  assert.equal(cart.mergeAdd([], only2, 1).status, "invalid");
  assert.equal(cart.mergeAdd([], only2, 2).cart[0].quantity, 2);
});

test("cap by seats: adding beyond the free seats clamps, at the cap reports max", () => {
  const p = product(row("m1", Object.assign({ seats_booked: "5" }, TIERS)));       // 3 liberi
  assert.equal(cart.mergeAdd([], p, 8).cart[0].quantity, 3);
  assert.equal(cart.cartTotalCents(cart.mergeAdd([], p, 8).cart, reg(p)), 25500);
  const full = cart.mergeAdd([], p, 3);
  assert.equal(cart.mergeAdd(full.cart, p, 1).status, "max");
  const sold = product(row("m1", Object.assign({ seats_booked: "8" }, TIERS)));
  assert.equal(cart.mergeAdd([], sold, 1).status, "invalid");
});

test("adding the same masterclass again sums the persons within the cap and re-prices from the tier", () => {
  const p = product(row("m1", TIERS));
  let r = cart.mergeAdd([], p, 1);
  r = cart.mergeAdd(r.cart, p, 1);
  assert.equal(r.cart.length, 1);
  assert.equal(r.cart[0].quantity, 2);
  assert.equal(cart.cartTotalCents(r.cart, reg(p)), 18000);       // 180, non 100 + 100
  assert.equal(r.cart[0].line_amount, 18000);
  r = cart.mergeAdd(r.cart, p, 5);
  assert.equal(r.cart[0].quantity, 7);
  r = cart.mergeAdd(r.cart, p, 5);
  assert.equal(r.cart[0].quantity, 8);
  assert.equal(cart.cartTotalCents(r.cart, reg(p)), 48000);
  assert.equal(cart.mergeAdd(r.cart, p, 1).status, "max");
});

test("two separate bookings (two checkouts) are each priced alone: 100 + 100", () => {
  const p = product(row("m1", TIERS));
  const q = product(row("m2", TIERS));
  let r = cart.mergeAdd([], p, 1);
  r = cart.mergeAdd(r.cart, q, 1);
  assert.equal(r.cart.length, 2);
  assert.equal(cart.cartTotalCents(r.cart, reg(p, q)), 20000);
  // lo stesso gruppo prenotato in un solo checkout costa il prezzo del gruppo
  assert.equal(cart.cartTotalCents(cart.mergeAdd([], p, 2).cart, reg(p)), 18000);
});

test("setPersons changes the persons and the tier price of an existing booking line", () => {
  const p = product(row("m1", Object.assign({ seats_booked: "2" }, TIERS)));       // max 6
  const base = cart.mergeAdd([], p, 1).cart;
  const r = cart.setPersons(base, p, "m1", 4);
  assert.equal(r.status, "ok");
  assert.equal(r.cart[0].quantity, 4);
  assert.equal(cart.cartTotalCents(r.cart, reg(p)), 32000);
  assert.equal(base[0].quantity, 1);                                              // input non modificato
  assert.equal(cart.setPersons(base, p, "m1", 7).status, "invalid");               // oltre i posti
  assert.equal(cart.setPersons(base, p, "nope", 2).status, "invalid");
  assert.equal(cart.setPersons(base, p, "m1", 0).status, "invalid");
});

test("the checkout payload stays {id, quantity} with quantity = persons (no unit price)", () => {
  const p = product(row("m1", TIERS));
  const line = cart.mergeAdd([], p, 3).cart[0];
  const items = [line].map((ci) => ({ id: ci.id, quantity: ci.quantity }));
  assert.deepEqual(items, [{ id: "m1", quantity: 3 }]);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "Stripe/js/uiStripe.js"), "utf8"), /cart\.map\(\(ci\) => \(\{ id: ci\.id, quantity: ci\.quantity \}\)\)/);
});

// ── riconciliazione ──
test("reconcile caps persons by seats, drops sold-out and vanished tiers, counts the adjustments", () => {
  const line = (id, q) => cart.mergeAdd([], product(row(id, TIERS)), q).cart[0];
  const fewer = product(row("m1", Object.assign({ seats_booked: "5" }, TIERS)));    // 3 liberi
  let r = cart.reconcile([line("m1", 6)], reg(fewer));
  assert.equal(r.cart[0].quantity, 3);
  assert.equal(r.cart[0].line_amount, 25500);
  assert.equal(r.adjusted, 1);
  assert.equal(r.removed, 0);
  assert.equal(r.changed, true);

  const soldOut = product(row("m1", Object.assign({ seats_booked: "8" }, TIERS)));
  r = cart.reconcile([line("m1", 2)], reg(soldOut));
  assert.deepEqual([r.cart.length, r.removed, r.adjusted], [0, 1, 0]);

  // il gruppo da 5 non e' piu' offerto: si scende al piu' vicino per difetto
  const gap = product(row("m1", { price_1: "100", price_2: "180", price_3: "250", price_4: "320", price_6: "420" }));
  r = cart.reconcile([line("m1", 5)], reg(gap));
  assert.equal(r.cart[0].quantity, 4);
  assert.equal(r.adjusted, 1);
  // nessun gruppo piu' offerto per quella riga: tolta
  const only6 = product(row("m1", { price_6: "420" }));
  r = cart.reconcile([line("m1", 2)], reg(only6));
  assert.deepEqual([r.cart.length, r.removed], [0, 1]);
  // prodotto sparito
  r = cart.reconcile([line("m1", 2)], {});
  assert.equal(r.removed, 1);
});

test("reconcile re-prices from the tier when the sheet price changes, unchanged data reports no change", () => {
  const l = cart.mergeAdd([], product(row("m1", TIERS)), 2).cart[0];
  const cheaper = product(row("m1", Object.assign({}, TIERS, { price_2: "170" })));
  const r = cart.reconcile([l], reg(cheaper));
  assert.equal(r.cart[0].line_amount, 17000);
  assert.equal(cart.cartTotalCents(r.cart, reg(cheaper)), 17000);
  assert.equal(r.adjusted, 0);
  assert.equal(cart.reconcile([l], reg(product(row("m1", TIERS)))).changed, false);
});

test("reconcile with the digital catalogue unknown leaves a booking line alone", () => {
  const l = cart.mergeAdd([], product(row("m1", TIERS)), 2).cart[0];
  const r = cart.reconcile([l], {}, { digitalKnown: false });
  assert.deepEqual(r.cart, [l]);
});

test("a saved booking line survives sanitizeCart with its kind; gift-card lines stay unit x quantity", () => {
  const l = cart.mergeAdd([], product(row("m1", TIERS)), 2).cart[0];
  const s = cart.sanitizeCart(JSON.parse(JSON.stringify([l]))).cart[0];
  assert.equal(s.kind, "masterclass");
  assert.equal(s.quantity, 2);
  assert.equal(s.line_amount, 18000);
  assert.equal(cart.sanitizeLine(Object.assign({}, l, { quantity: 50 })).quantity, 8);   // tetto 8 persone
  assert.equal(cart.sanitizeLine({ id: "x", type: "physical", kind: "masterclass", quantity: 1 }).kind, undefined);
  const gc = { id: "gc-1", type: "digital", priceCents: 5000, maxQty: 10, titles: { it: "GC" } };
  const g = cart.mergeAdd([], gc, 3).cart[0];
  assert.equal(cart.lineTotalCents(g, gc), 15000);
  // nessun registro: la riga masterclass usa il totale salvato (solo visualizzazione)
  assert.equal(cart.lineTotalCents(l, undefined), 18000);
});

// ── titoli, plurali, testi ──
test("titles and texts fall back current -> it -> en -> ru, skipping empty and '-'", () => {
  const pick = (o, lang) => util.pickLangField(o, "name", lang, "it");
  assert.equal(pick({ name_it: "I", name_en: "E", name_ru: "R" }, "en"), "E");
  assert.equal(pick({ name_it: "I", name_en: "", name_ru: "R" }, "en"), "I");
  assert.equal(pick({ name_it: "", name_en: "E", name_ru: "R" }, "ru"), "R");
  assert.equal(pick({ name_it: "", name_en: "E", name_ru: "" }, "ru"), "E");
  assert.equal(pick({ name_it: "-", name_en: "-", name_ru: "R" }, "en"), "R");
  assert.equal(pick({ name_it: "", name_en: "", name_ru: "R" }, "it"), "R");
  assert.equal(pick({ name_it: "", name_en: "", name_ru: "" }, "en"), "");
  assert.equal(pick({}, "ru"), "");
  // vale anche per short / long
  assert.equal(util.pickLangField({ short_it: "", short_en: "S" }, "short", "ru", "it"), "S");
});

test("persons plural forms: it/en singular+plural, ru 1 / 2-4 / 5-8", () => {
  const t = (k, l) => globalThis.CD.i18n.t(k, l);
  const label = (n, l) => util.personsLabel(n, l, t);
  assert.equal(label(1, "it"), "1 persona");
  assert.equal(label(2, "it"), "2 persone");
  assert.equal(label(8, "it"), "8 persone");
  assert.equal(label(1, "en"), "1 person");
  assert.equal(label(2, "en"), "2 people");
  assert.equal(label(1, "ru"), "1 человек");
  for (const n of [2, 3, 4]) assert.equal(label(n, "ru"), n + " человека");
  for (const n of [5, 6, 7, 8]) assert.equal(label(n, "ru"), n + " человек");
  assert.equal(util.personsKey(11, "ru"), "masterclass.personMany");
  assert.equal(util.personsKey(21, "ru"), "masterclass.personOne");
});

test("total text shows the tier TOTAL and the per-person price, formatted by money.js", () => {
  require("../masterclass.js");
  const p = product(row("m1", TIERS));
  const tt = (n, lang) => globalThis.CD.masterclass.totalText(p, n, lang);
  assert.equal(tt(1, "it"), "Totale 100 €");
  assert.equal(tt(2, "it"), "Totale 180 € (90 € a persona)");
  assert.equal(tt(2, "en"), "Total €180 (€90 per person)");
  assert.equal(tt(2, "ru"), "Итого 180 € (90 € с человека)");
  assert.equal(tt(3, "it"), "Totale 255 € (85 € a persona)");
  assert.equal(tt(9, "it"), "");
  const odd = product(row("m2", { price_1: "100", price_2: "170", price_3: "170" }));
  assert.equal(globalThis.CD.masterclass.totalText(odd, 3, "it"), "Totale 170 € (56,67 € a persona)");
  assert.equal(money.format(18000, "it"), "180 €");
});

test("new i18n keys exist in it/en/ru with the {n}/{total}/{per} placeholders where needed", () => {
  for (const l of ["it", "en", "ru"]) {
    const m = messages[l];
    for (const k of ["seatsFree", "seatsFreeOne", "soldOut", "persons", "personOne", "personFew", "personMany", "total", "totalPer", "book"]) {
      assert.ok(m.masterclass[k], `${l}.masterclass.${k}`);
    }
    for (const k of ["persons", "bookingAdjusted", "notEnoughSeats", "soldOut", "groupUnavailable"]) assert.ok(m.cart[k], `${l}.cart.${k}`);
    assert.match(m.masterclass.seatsFree, /\{n\}/);
    assert.match(m.masterclass.totalPer, /\{total\}.*\{per\}/);
    assert.match(m.masterclass.personMany, /\{n\}/);
  }
  assert.equal(util.fillTemplate(messages.it.masterclass.seatsFree, { n: 6 }), "6 posti liberi");
  assert.equal(messages.it.masterclass.soldOut, "Completo");
});

test("server booking error codes map to translated messages and the line is dropped", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Stripe/js/uiStripe.js"), "utf8");
  for (const [code, key] of [["not_enough_seats", "cart.notEnoughSeats"], ["sold_out", "cart.soldOut"], ["group_size_unavailable", "cart.groupUnavailable"]]) {
    assert.match(src, new RegExp(code + ': "' + key.replace(".", "\\.") + '"'));
  }
  assert.match(src, /serverError === "item_sold" \|\| serverError === "sold_out"/);
});

// ── rendering (DOM finto) ──
function fakeDom() {
  const el = (extra) => Object.assign({ innerHTML: "", children: [], dataset: {}, hidden: false, className: "", id: "",
    appendChild(c) { this.children.push(c); }, addEventListener() {}, setAttribute() {} }, extra);
  const nodes = { "masterclass-grid": el(), "masterclass-modal-container": el(), "masterclass-lead": el() };
  globalThis.document = {
    getElementById: (id) => nodes[id] || null,
    createElement: () => el(),
    addEventListener() {},
    querySelectorAll: () => []
  };
  return nodes;
}
function renderRows(rows, lang) {
  const nodes = fakeDom();
  globalThis.CD.shop = { products: {}, addProduct() {}, showNotice() {} };
  const n = globalThis.CD.masterclass.render(rows, lang);
  return { n, nodes, html: nodes["masterclass-grid"].children.map((c) => c.innerHTML).join("\n"), modals: nodes["masterclass-modal-container"].children.map((c) => c.innerHTML).join("\n") };
}

test("render: card and modal show date/time/level, free seats, selector 1..N and the total", () => {
  require("../masterclass.js");
  const { n, html, modals } = renderRows([row("mc1", Object.assign({ name_it: "Titolo", name_en: "", seats_booked: "2" }, TIERS))], "en");
  assert.equal(n, 1);
  for (const out of [html, modals]) {
    assert.match(out, /01\.01\.2099/);
    assert.match(out, /10:00/);
    assert.match(out, /6 seats left/);
    assert.match(out, /data-persons="mc1"/);
    assert.match(out, /<option value="6">6 people<\/option>/);
    assert.doesNotMatch(out, /<option value="7"/);
    assert.match(out, /Total €100/);
    assert.match(out, /data-add-to-cart="mc1"/);
  }
  assert.match(html, /<h4>Titolo<\/h4>/);                         // fallback en -> it
  assert.equal(globalThis.CD.shop.products.mc1.maxQty, 6);
});

test("render: sold-out masterclass shows the 'Completo' badge, no selector and no add button", () => {
  require("../masterclass.js");
  const { n, html, modals } = renderRows([row("mc1", Object.assign({ seats_booked: "8" }, TIERS))], "it");
  assert.equal(n, 1);
  for (const out of [html, modals]) {
    assert.match(out, /Completo/);
    assert.doesNotMatch(out, /data-persons=/);
    assert.doesNotMatch(out, /data-add-to-cart/);
  }
  assert.equal(globalThis.CD.shop.products.mc1.sold, true);
});

test("render: legacy row keeps working (linear tiers, 'spots' text, selector up to the seats)", () => {
  require("../masterclass.js");
  const legacy = { id: "mc1", name_it: "L", date: "01.01.2099", time: "10", level: "b", spots: "Max 3 persone", price: "100€", img1: "" };
  const { n, html } = renderRows([legacy], "it");
  assert.equal(n, 1);
  assert.match(html, /Max 3 persone/);
  assert.match(html, /<option value="3">3 persone<\/option>/);
  assert.doesNotMatch(html, /<option value="4"/);
  assert.match(html, /Totale 100 €/);
  assert.equal(globalThis.CD.shop.products.mc1.tiersCents[2], 30000);
});

test("render: past events are hidden and the empty-state note stays", () => {
  require("../masterclass.js");
  const { n, nodes } = renderRows(sheetRows("catalogue-tab-Masterclass-v2.csv"), "it");   // tutte il 12.01.2026
  assert.equal(n, 0);
  assert.match(nodes["masterclass-grid"].innerHTML, /workshops\.noEvents/);
  assert.equal(nodes["masterclass-lead"].hidden, true);
});

test("render: sheet text is escaped (titles, texts, level, spots, seats) and image names stay plain files", () => {
  require("../masterclass.js");
  const evil = '<img src=x onerror=alert(1)>"\'&';
  const rows = [row("mc1", Object.assign({ name_it: evil, short_it: evil, long_it: evil, level: evil, time: evil, date: "01.01.2099 " + evil, img1: "a<b>.jpg" }, TIERS))];
  const { html, modals } = renderRows(quiet(() => live.parseTab("masterclass", { headers: Object.keys(rows[0]), rows })), "it");
  for (const out of [html, modals]) {
    assert.doesNotMatch(out, /<img src=x/);
    assert.doesNotMatch(out, /onerror=alert\(1\)>/);
    assert.match(out, /&lt;img src=x onerror=alert\(1\)&gt;&quot;&#39;&amp;/);
  }
  const src = fs.readFileSync(path.join(__dirname, "..", "masterclass.js"), "utf8");
  assert.doesNotMatch(src, /\$\{\s*(mc|row)\.[a-z_0-9]+\s*\}/, "raw sheet value interpolated into HTML");
  assert.match(src, /encodeURIComponent\(fn\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "Stripe/js/uiStripe.js"), "utf8"), /esc\(util\(\)\.personsLabel/);
});

test("render: selected persons are preserved across a re-render (language switch)", () => {
  require("../masterclass.js");
  const r = row("mc1", TIERS);
  const first = renderRows([r], "it");
  assert.match(first.html, /<option value="1" selected>/);
  // simula la scelta di 3 persone tramite il delegato "change"
  const handlers = [];
  const nodes = fakeDom();
  nodes["masterclass-grid"].addEventListener = (ev, fn) => handlers.push(fn);
  nodes["masterclass-grid"].dataset = {};
  globalThis.CD.shop = { products: {}, addProduct() {}, showNotice() {} };
  globalThis.CD.masterclass.render([r], "it");
  const sel = { value: "3", getAttribute: () => "mc1", closest() { return this; } };
  const totals = [{ getAttribute: () => "mc1", innerHTML: "" }];
  globalThis.document.querySelectorAll = (q) => (q === "[data-persons-total]" ? totals : [sel]);
  handlers[0]({ target: sel });
  assert.match(totals[0].innerHTML, /Totale 255 € \(85 € a persona\)/);
  const second = renderRows([r], "ru");
  assert.match(second.html, /<option value="3" selected>3 человека<\/option>/);
});
