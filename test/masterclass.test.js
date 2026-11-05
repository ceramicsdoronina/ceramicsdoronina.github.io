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
  return { id: r.id, type: "digital", sold: b.sold, titles: { it: r.name_it }, priceCents: b.priceCents, tiersCents: b.tiersCents, pricing: b.pricing, linearCents: b.linearCents, maxQty: b.maxQty, img: "images/masterclass/x.jpg" };
}
const nulls = (n) => Array(n).fill(null);
const reg = (...ps) => Object.fromEntries(ps.map((p) => [p.id, p]));

// ── dati reali (fixture) ──
test("v2 fixture rows pass through the endpoint tab parser and give the 1/2-person tiers", () => {
  const rows = sheetRows("catalogue-tab-Masterclass-v2.csv");
  assert.equal(rows.length, 6);
  for (const r of rows) {
    const b = util.bookingFromRow(r);
    assert.deepEqual(b.tiersCents, [10000, 18000].concat(nulls(18)));
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
    assert.deepEqual(b.tiersCents, Array.from({ length: 20 }, (_, i) => 10000 * (i + 1)));
    assert.equal(b.seatsTotal, 6);
    assert.equal(b.seatsFree, 6);
    assert.equal(b.maxQty, 6);
    assert.equal(b.priceCents, 10000);
    assert.deepEqual(cart.offeredPersons(product(r)), [1, 2, 3, 4, 5, 6]);
  }
});

test("legacy row without a usable spots number defaults to 6 seats; bad price = not bookable", () => {
  assert.equal(util.bookingFromRow({ id: "a", price: "90", spots: "pochi" }).seatsTotal, 6);
  assert.equal(util.bookingFromRow({ id: "a", price: "90", spots: "Max 12 persone" }).maxQty, 12);
  assert.equal(util.bookingFromRow({ id: "a", price: "90", spots: "Max 30 persone" }).maxQty, 20);   // tetto 20, legacy MAI illimitato
  assert.equal(util.bookingFromRow({ id: "a", price: "90", spots: "" }).seatsFree, 6);
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
  assert.deepEqual(b.tiersCents, [10000, 18000, null, 32000].concat(nulls(16)));
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
  // seats_total vuoto: illimitati (vedi test dedicati)
  assert.equal(util.bookingFromRow(row("m", Object.assign({ seats_total: "" }, TIERS))).seatsTotal, null);
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
  assert.equal(cart.sanitizeLine(Object.assign({}, l, { quantity: 5000 })).quantity, 999);   // tetto tecnico (le tabelle sono poi limitate da reconcile)
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

test("persons plural forms: it/en singular+plural, ru 1 / 2-4 / 5-20 / 21 (n%10, n%100)", () => {
  const t = (k, l) => globalThis.CD.i18n.t(k, l);
  const label = (n, l) => util.personsLabel(n, l, t);
  assert.equal(label(1, "it"), "1 persona");
  for (const n of [2, 4, 5, 11, 12, 14, 20]) assert.equal(label(n, "it"), n + " persone");
  assert.equal(label(1, "en"), "1 person");
  for (const n of [2, 4, 5, 11, 12, 14, 20]) assert.equal(label(n, "en"), n + " people");
  assert.equal(label(1, "ru"), "1 человек");
  for (const n of [2, 3, 4]) assert.equal(label(n, "ru"), n + " человека");
  for (const n of [5, 6, 7, 8, 11, 12, 13, 14, 15, 19, 20]) assert.equal(label(n, "ru"), n + " человек");
  assert.equal(label(21, "ru"), "21 человек");
  assert.equal(label(22, "ru"), "22 человека");
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
    for (const k of ["seatsFree", "seatsFreeOne", "seatsAvailable", "soldOut", "persons", "personOne", "personFew", "personMany", "total", "totalPer", "book"]) {
      assert.ok(m.masterclass[k], `${l}.masterclass.${k}`);
    }
    for (const k of ["persons", "bookingAdjusted", "notEnoughSeats", "soldOut", "groupUnavailable", "itemHeld"]) assert.ok(m.cart[k], `${l}.cart.${k}`);
    assert.match(m.masterclass.seatsFree, /\{n\}/);
    assert.match(m.masterclass.totalPer, /\{total\}.*\{per\}/);
    assert.match(m.masterclass.personMany, /\{n\}/);
  }
  assert.equal(util.fillTemplate(messages.it.masterclass.seatsFree, { n: 6 }), "6 posti liberi");
  assert.equal(messages.it.masterclass.soldOut, "Completo");
  assert.equal(messages.it.masterclass.seatsAvailable, "Posti disponibili");
  assert.equal(messages.en.masterclass.seatsAvailable, "Seats available");
  assert.equal(messages.ru.masterclass.seatsAvailable, "Места есть");
});

// ── gruppi fino a 20, posti illimitati (v3) ──
// riga v3: price_1..price_20 e seats_total vuoto (illimitato) salvo diversa indicazione
const row3 = (id, o) => {
  const r = Object.assign({ id, name_it: "MC " + id, date: "01.01.2099", time: "10:00", level: "x", seats_total: "", seats_booked: "0", seats_free: "", img1: "" }, o);
  for (let n = 1; n <= 20; n++) if (!(("price_" + n) in r)) r["price_" + n] = "";
  return r;
};
const product3 = (r) => {
  const b = util.bookingFromRow(r);
  return { id: r.id, type: "digital", sold: b.sold, titles: { it: r.name_it }, priceCents: b.priceCents, tiersCents: b.tiersCents, pricing: b.pricing, linearCents: b.linearCents, maxQty: b.maxQty, seatsFree: b.seatsFree, seatsTotal: b.seatsTotal, img: "images/masterclass/x.jpg" };
};
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test("rule A: only price_1 filled -> linear, any size is N x price_1 (1, 7, 20, 21)", () => {
  const b = util.bookingFromRow(row3("m", { price_1: "50" }));
  assert.equal(b.pricing, "linear");
  assert.equal(b.linearCents, 5000);
  assert.equal(b.tiersCents.length, 20);
  assert.equal(b.tiersCents[0], 5000);
  assert.equal(b.tiersCents[6], 35000);
  assert.equal(b.tiersCents[19], 100000);
  const p = product3(row3("m", { price_1: "50" }));
  assert.deepEqual(cart.offeredPersons(p), range(1, 999));
  for (const n of [1, 7, 20, 21]) assert.equal(cart.mergeAdd([], p, n).cart[0].line_amount, 5000 * n);
  // columns price_9..price_20 missing from the row entirely are blank too
  const slim = { id: "m", price_1: "50", price_2: "", seats_total: "" };
  assert.equal(product3(slim).pricing, "linear");
  assert.equal(cart.personsCap(product3(slim)), 999);
  // text, per-person price is identical
  require("../masterclass.js");
  assert.equal(globalThis.CD.masterclass.totalText(p, 20, "it"), "Totale 1000 € (50 € a persona)");
  assert.equal(globalThis.CD.masterclass.totalText(p, 7, "en"), "Total €350 (€50 per person)");
});

test("explicit tiers 1..8 disable rule A: 9 is not offered", () => {
  const p = product3(row3("m", TIERS));
  assert.deepEqual(cart.offeredPersons(p), range(1, 8));
  assert.equal(cart.tierCents(p, 9), null);
  assert.equal(cart.mergeAdd([], p, 20).cart[0].quantity, 8);
  // a single filled price_2 is enough to turn rule A off
  assert.deepEqual(cart.offeredPersons(product3(row3("m", { price_1: "50", price_20: "900" }))), [1, 20]);
});

test("unlimited default (seats_total blank): no seat cap, never sold out, numeric field, no seats number", () => {
  const b = util.bookingFromRow(row3("m", { price_1: "50", seats_booked: "7" }));
  assert.equal(b.seatsTotal, null);
  assert.equal(b.seatsFree, null);
  assert.equal(b.maxQty, 999);
  assert.equal(b.sold, false);
  // a stray seats_free on an unlimited row is ignored
  assert.equal(util.bookingFromRow(row3("m", { price_1: "50", seats_free: "3" })).maxQty, 999);
  // absent seats_total column too
  assert.equal(util.bookingFromRow({ id: "m", price_1: "50" }).seatsFree, null);
  require("../masterclass.js");
  const { html, modals } = renderRows([row3("mc1", { price_1: "50", seats_booked: "7" })], "en");
  for (const out of [html, modals]) {
    assert.match(out, /Seats available/);
    assert.doesNotMatch(out, /seats left|Fully booked/);
    assert.match(out, /<input type="number" class="mc-persons-input" data-persons="mc1" min="1" max="999" step="1" inputmode="numeric"/);
    assert.match(out, /value="1">/);
    assert.doesNotMatch(out, /<select|<option|mc-hint/);
    assert.match(out, /data-add-to-cart="mc1"/);
  }
  assert.equal(globalThis.CD.shop.products.mc1.seatsFree, null);
  assert.equal(globalThis.CD.shop.products.mc1.sold, false);
});

test("limited seats_total 30 with 5 booked -> 25 free, max 25 (numeric field); 3 free -> max 3; 0 free -> sold", () => {
  const a = util.bookingFromRow(row3("m", { price_1: "50", seats_total: "30", seats_booked: "5" }));
  assert.deepEqual([a.seatsTotal, a.seatsFree, a.maxQty], [30, 25, 25]);
  const b = util.bookingFromRow(row3("m", { price_1: "50", seats_total: "30", seats_booked: "27" }));
  assert.deepEqual([b.seatsFree, b.maxQty], [3, 3]);
  assert.deepEqual(cart.offeredPersons(product3(row3("m", { price_1: "50", seats_total: "30", seats_booked: "27" }))), [1, 2, 3]);
  // endpoint seats_free: the smaller wins
  assert.equal(util.bookingFromRow(row3("m", { price_1: "50", seats_total: "30", seats_booked: "5", seats_free: "10" })).seatsFree, 10);
  assert.equal(util.bookingFromRow(row3("m", { price_1: "50", seats_total: "30", seats_booked: "5", seats_free: "40" })).seatsFree, 25);
  const z = util.bookingFromRow(row3("m", { price_1: "50", seats_total: "30", seats_booked: "30" }));
  assert.deepEqual([z.seatsFree, z.maxQty, z.sold], [0, 0, true]);
  assert.equal(util.bookingFromRow(row3("m", { price_1: "50", seats_total: "0" })).sold, true);
  const { html } = renderRows([row3("mc1", { price_1: "50", seats_total: "30", seats_booked: "5" })], "en");
  assert.match(html, /25 seats left/);
  assert.match(html, /<input type="number"[^>]* max="25"[^>]* aria-describedby="mc-hint-mc1-c"/);
  assert.match(html, /<span class="mc-hint" id="mc-hint-mc1-c">Maximum 25 people<\/span>/);
});

test("legacy rows keep the 20 cap and are never unlimited", () => {
  const b = util.bookingFromRow({ id: "a", price: "100", spots: "Max 25" });
  assert.equal(b.legacy, true);
  assert.equal(b.seatsFree, 25);
  assert.equal(b.maxQty, 20);
  assert.equal(b.tiersCents.length, 20);
  assert.equal(b.tiersCents[19], 200000);
  const d = util.bookingFromRow({ id: "a", price: "100" });
  assert.deepEqual([d.seatsTotal, d.seatsFree, d.maxQty], [6, 6, 6]);
});

test("reconcile (linear): caps by the maximum, by free seats only when limited, drops only when not offered or sold out", () => {
  const unl = product3(row3("m1", { price_1: "50" }));
  const lim = (booked) => product3(row3("m1", { price_1: "50", seats_total: "30", seats_booked: String(booked) }));
  const line = (p, q) => cart.mergeAdd([], p, q).cart[0];
  // unlimited: 20 persons stay, never sold out
  let r = cart.reconcile([line(unl, 20)], reg(unl));
  assert.deepEqual([r.cart[0].quantity, r.removed, r.adjusted, r.changed], [20, 0, 0, false]);
  // large N stays too (150 x 50 = 7500 euros); only the technical maximum caps it
  r = cart.reconcile([line(unl, 150)], reg(unl));
  assert.deepEqual([r.cart[0].quantity, r.cart[0].line_amount, r.changed], [150, 750000, false]);
  r = cart.reconcile([Object.assign({}, line(unl, 20), { quantity: 5000 })], reg(unl));
  assert.deepEqual([r.cart[0].quantity, r.adjusted], [999, 1]);
  // limited: capped by the free seats, dropped at 0 free
  r = cart.reconcile([line(unl, 20)], reg(lim(25)));       // 5 free
  assert.deepEqual([r.cart[0].quantity, r.cart[0].line_amount, r.adjusted], [5, 25000, 1]);
  r = cart.reconcile([line(unl, 4)], reg(lim(30)));
  assert.deepEqual([r.cart.length, r.removed], [0, 1]);
  // limited -> unlimited: nothing to cut
  r = cart.reconcile([line(unl, 12)], reg(unl));
  assert.equal(r.cart[0].quantity, 12);
  // explicit tiers arrive: size 12 no longer offered, falls to the nearest offered below
  const tiers = product3(row3("m1", { price_1: "50", price_5: "200", price_10: "380" }));
  r = cart.reconcile([line(unl, 12)], reg(tiers));
  assert.equal(r.cart[0].quantity, 10);
  // a server "sold_out" override is the only way an unlimited one is sold: flag on the product
  r = cart.reconcile([line(unl, 3)], reg(Object.assign({}, unl, { sold: true })));
  assert.equal(r.removed, 1);
});

test("group_size_unavailable: table mode above 20 and linear above the maximum use the existing translated message", () => {
  assert.match(messages.it.cart.groupUnavailable, /dimensione di gruppo/);
  const lin = product3(row3("m", { price_1: "50" }));
  const tab = product3(row3("m", { price_1: "50", price_5: "200" }));
  assert.equal(cart.tierCents(tab, 21), null);
  assert.equal(cart.tierCents(lin, 21), 105000);
  assert.equal(cart.tierCents(lin, 1000), null);
  const line = cart.mergeAdd([], lin, 1).cart;
  assert.equal(cart.setPersons(line, lin, "m", 1000).status, "invalid");
  assert.equal(cart.setPersons(line, lin, "m", 21).status, "ok");
  assert.equal(cart.setPersons(cart.mergeAdd([], tab, 1).cart, tab, "m", 21).status, "invalid");
});

// ── prezzo lineare: N x price_1, campo numerico ──
const lin3 = (o) => product3(row3("m", Object.assign({ price_1: "50" }, o)));

test("linear unlimited: numeric field, N = 1, 20, 21, 150, 999 priced N x price_1", () => {
  const p = lin3();
  assert.equal(cart.personsInput(p), "number");
  for (const n of [1, 20, 21, 150, 999]) {
    const l = cart.mergeAdd([], p, n).cart[0];
    assert.deepEqual([l.quantity, l.line_amount], [n, 5000 * n]);
    assert.equal(cart.cartTotalCents([l], reg(p)), 5000 * n);
  }
  // above the maximum clamps to it
  assert.equal(cart.mergeAdd([], p, 1000).cart[0].quantity, 999);
  assert.equal(cart.mergeAdd([], p, 5000).cart[0].quantity, 999);
});

test("price_1 5000 euros -> maxPersons 199; linearMaxPersons is min(999, floor(99999999 / cents))", () => {
  const b = util.bookingFromRow(row3("m", { price_1: "5000" }));
  assert.deepEqual([b.maxPersons, b.maxQty], [199, 199]);
  const p = lin3({ price_1: "5000" });
  assert.equal(cart.personsCap(p), 199);
  assert.equal(cart.mergeAdd([], p, 500).cart[0].line_amount, 199 * 500000);
  assert.ok(199 * 500000 <= 99999999);
  assert.equal(util.linearMaxPersons(1), 999);
  assert.equal(util.linearMaxPersons(100000), 999);
  assert.equal(util.linearMaxPersons(100001), 999);
  assert.equal(util.linearMaxPersons(500000), 199);
  assert.equal(util.linearMaxPersons(0), 0);
});

test("linear limited: 30 seats with 5 booked -> max 25 and numeric field; free 12 -> dropdown 1..12", () => {
  const a = lin3({ seats_total: "30", seats_booked: "5" });
  assert.equal(cart.personsCap(a), 25);
  assert.equal(cart.personsInput(a), "number");
  assert.equal(cart.mergeAdd([], a, 40).cart[0].quantity, 25);
  const b = lin3({ seats_total: "30", seats_booked: "18" });
  assert.equal(cart.personsInput(b), "select");
  assert.deepEqual(cart.offeredPersons(b), range(1, 12));
  const c = lin3({ seats_total: "20", seats_booked: "0" });      // max exactly 20, limited: still a dropdown
  assert.equal(cart.personsInput(c), "select");
  assert.equal(cart.personsInput(lin3({ seats_total: "21" })), "number");
  const { html } = renderRows([row3("mc1", { price_1: "50", seats_total: "30", seats_booked: "18" })], "it");
  assert.match(html, /<select data-persons="mc1"/);
  assert.match(html, /<option value="12">12 persone<\/option>/);
  assert.doesNotMatch(html, /<option value="13"|type="number"/);
});

test("table mode unchanged: dropdown of the filled sizes, 9 not offered when only 1..8 are filled", () => {
  const p = product3(row3("m", TIERS));
  assert.equal(p.pricing, "table");
  assert.equal(cart.personsInput(p), "select");
  assert.deepEqual(cart.offeredPersons(p), range(1, 8));
  assert.equal(cart.fitPersons(p, 9), 8);
  const unl = product3(row3("m", { price_1: "50", price_2: "90", price_25: "x" }));
  assert.equal(unl.pricing, "table");
  assert.equal(cart.personsInput(unl), "select");
  assert.equal(cart.personsCap(unl), 2);
  const { html } = renderRows([row3("mc1", Object.assign({}, TIERS))], "en");
  assert.match(html, /<select data-persons="mc1"/);
  assert.doesNotMatch(html, /type="number"|<option value="9"/);
});

test("linear numeric field: clamp rules (0 / empty / NaN -> 1, above max -> max, decimals floor)", () => {
  require("../masterclass.js");
  const p = lin3({ seats_total: "30", seats_booked: "5" });
  const handlers = [];
  const nodes = fakeDom();
  nodes["masterclass-grid"].addEventListener = (ev, fn) => handlers.push([ev, fn]);
  nodes["masterclass-grid"].dataset = {};
  globalThis.CD.shop = { products: {}, addProduct() {}, showNotice() {} };
  globalThis.CD.masterclass.render([row3("mc1", { price_1: "50", seats_total: "30", seats_booked: "5" })], "en");
  assert.deepEqual(handlers.map((h) => h[0]), ["change", "input", "focusout"]);
  const change = handlers[0][1];
  const field = { value: "", getAttribute: () => "mc1", closest() { return this; } };
  const totals = [{ getAttribute: () => "mc1", innerHTML: "" }];
  globalThis.document.querySelectorAll = (q) => (q === "[data-persons-total]" ? totals : [field]);
  const expect = [["", 1], ["0", 1], ["abc", 1], ["-4", 1], ["7", 7], ["12.9", 12], ["26", 25], ["999", 25]];
  for (const [raw, n] of expect) {
    field.value = raw;
    change({ type: "change", target: field });
    assert.equal(field.value, String(n), raw);
    assert.match(totals[0].innerHTML, new RegExp("Totale " + (50 * n) + " €"), raw);
  }
  // live typing: an empty / partial field is left alone while the total uses 1; above max is clamped
  field.value = "";
  change({ type: "input", target: field });
  assert.equal(field.value, "");
  assert.match(totals[0].innerHTML, /Totale 50 €/);
  field.value = "90";
  change({ type: "input", target: field });
  assert.equal(field.value, "25");
  // the choice is remembered across re-renders
  field.value = "9";
  change({ type: "change", target: field });
  const again = renderRows([row3("mc1", { price_1: "50", seats_total: "30", seats_booked: "5" })], "ru");
  assert.match(again.html, /value="9"/);
  assert.match(again.html, /Максимум 25 человек/);
  assert.match(again.html, /Итого 450 € \(50 € с человека\)/);
  assert.ok(p);
});

test("linear unlimited render: no max hint, accessible label, per-person price in the total", () => {
  const { html, modals } = renderRows([row3("mc1", { price_1: "50" })], "en");
  assert.match(html, /<label class="mc-persons">People\s*<input type="number"/);
  assert.doesNotMatch(html, /aria-describedby|mc-hint/);
  const two = globalThis.CD.masterclass.totalText(globalThis.CD.shop.products.mc1, 150, "en");
  assert.equal(two, "Total €7500 (€50 per person)");
  // hint ids differ between the card and the modal (same HTML lives in both)
  const lim = renderRows([row3("mc1", { price_1: "50", seats_total: "40" })], "en");
  assert.match(lim.html, /id="mc-hint-mc1-c"/);
  assert.match(lim.modals, /id="mc-hint-mc1-m"/);
  assert.ok(modals);
});

test("legacy rows unchanged: linear tiers up to 20, seats from spots, select, cap 20", () => {
  const b = util.bookingFromRow({ id: "a", price: "100", spots: "Max 25" });
  assert.equal(b.pricing, "legacy");
  const p = { id: "a", type: "digital", priceCents: b.priceCents, tiersCents: b.tiersCents, pricing: b.pricing, linearCents: b.linearCents, maxQty: b.maxQty, seatsFree: b.seatsFree };
  assert.equal(cart.personsInput(p), "select");
  assert.equal(cart.personsCap(p), 20);
  assert.equal(cart.tierCents(p, 21), null);
  assert.equal(cart.mergeAdd([], p, 50).cart[0].quantity, 20);
  const d = util.bookingFromRow({ id: "a", price: "100" });
  assert.equal(d.maxQty, 6);
  assert.deepEqual(cart.offeredPersons({ id: "a", type: "digital", tiersCents: d.tiersCents, maxQty: d.maxQty, priceCents: d.priceCents }), range(1, 6));
});

test("plural labels for any n up to 999 (it / en / ru) and the max hint", () => {
  const t = (k, l) => globalThis.CD.i18n.t(k, l);
  const ru = { 1: "человек", 2: "человека", 5: "человек", 11: "человек", 12: "человек", 21: "человек", 22: "человека", 25: "человек", 101: "человек", 111: "человек", 112: "человек", 999: "человек" };
  for (const [n, w] of Object.entries(ru)) assert.equal(util.personsLabel(+n, "ru", t), n + " " + w, n);
  for (const n of [2, 5, 11, 12, 21, 22, 25, 101, 111, 112, 999]) {
    assert.equal(util.personsLabel(n, "it", t), n + " persone");
    assert.equal(util.personsLabel(n, "en", t), n + " people");
  }
  assert.equal(util.personsLabel(1, "it", t), "1 persona");
  assert.equal(util.personsLabel(1, "en", t), "1 person");
  assert.equal(util.personsMaxHint(25, "it", t), "Massimo 25 persone");
  assert.equal(util.personsMaxHint(1, "en", t), "Maximum 1 person");
  assert.equal(util.personsMaxHint(22, "ru", t), "Максимум 22 человека");
  assert.equal(util.personsMaxHint(111, "ru", t), "Максимум 111 человек");
  for (const l of ["it", "en", "ru"]) assert.match(messages[l].masterclass.personsMax, /\{label\}/);
});

test("uiStripe drawer: persons control follows the same choice (number input / select)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Stripe/js/uiStripe.js"), "utf8");
  assert.match(src, /personsInput\(p\) === "number"/);
  assert.match(src, /<input type="number" class="cart-item__persons"/);
  assert.match(src, /<select class="cart-item__persons"/);
});

test("server booking error codes map to translated messages and the line is dropped", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Stripe/js/uiStripe.js"), "utf8");
  for (const [code, key] of [["not_enough_seats", "cart.notEnoughSeats"], ["sold_out", "cart.soldOut"], ["group_size_unavailable", "cart.groupUnavailable"]]) {
    assert.match(src, new RegExp(code + ': "' + key.replace(".", "\\.") + '"'));
  }
  assert.match(src, /serverError === "item_sold" \|\| serverError === "sold_out"/);
});

test("item_held: a unique piece held by another customer keeps its line in the cart and shows the translated notice (no drop, not marked sold)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Stripe/js/uiStripe.js"), "utf8");
  const branch = src.slice(src.indexOf('err.serverError === "item_held"'), src.indexOf("await dropUnavailableItem"));
  assert.match(branch, /showNotice\(t\("cart\.itemHeld"\)/);
  assert.doesNotMatch(branch, /dropUnavailableItem|markSold|removeLine/);
  assert.ok(src.indexOf('err.serverError === "item_held"') < src.indexOf("await dropUnavailableItem"), "checked before the generic 400-with-item branch");
  for (const l of ["it", "en", "ru"]) assert.ok(messages[l].cart.itemHeld.length > 20, l);
  assert.match(messages.it.cart.itemHeld, /30 minuti/);
});

test("pending marker has no age TTL", () => {
  const c = require("../Stripe/js/cart.js");
  assert.equal(c.PENDING_TTL_MS, undefined);
  assert.ok(c.PENDING_MAX_ENTRIES >= 20);
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
