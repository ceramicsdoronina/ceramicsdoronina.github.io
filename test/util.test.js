// test/util.test.js  -  date evento, id, flag venduto, escape, registro prodotti
const test = require("node:test");
const assert = require("node:assert/strict");
const util = require("../Stripe/js/util.js");

const ymd = (p) => p && `${p.y}-${p.m}-${p.d}`;

test("parseEventDateParts: formats and ranges", () => {
  assert.equal(ymd(util.parseEventDateParts("10.12.2026")), "2026-12-10");
  assert.equal(ymd(util.parseEventDateParts("1/2/2026")), "2026-2-1");
  assert.equal(ymd(util.parseEventDateParts("10/12/2026")), "2026-12-10");
  assert.equal(ymd(util.parseEventDateParts("10-12-2026")), "2026-12-10");
  assert.equal(ymd(util.parseEventDateParts("2026-12-10")), "2026-12-10");
  assert.equal(ymd(util.parseEventDateParts("Sabato 10.12.2026, ore 10")), "2026-12-10");
  // intervallo: vale l'ULTIMA data
  assert.equal(ymd(util.parseEventDateParts("10.12.2026 - 12.12.2026")), "2026-12-12");
  assert.equal(ymd(util.parseEventDateParts("12.12.2026 / 10.12.2026")), "2026-12-10");
  assert.equal(ymd(util.parseEventDateParts("2026-12-10 - 2026-12-12")), "2026-12-12");
  assert.equal(ymd(util.parseEventDateParts("30.11.2026 e 2026-12-12")), "2026-12-12");
});

test("parseEventDateParts: invalid or missing dates", () => {
  for (const bad of ["31.02.2026", "29.02.2026", "00.01.2026", "32.01.2026", "10.13.2026", "da definire", "", null, undefined, "-", "10.12.26", "2026-02-30"]) {
    assert.equal(util.parseEventDateParts(bad), null, String(bad));
  }
  assert.equal(ymd(util.parseEventDateParts("29.02.2028")), "2028-2-29");   // anno bisestile
  assert.equal(util.parseEventDateParts("10.12.2026 - 31.02.2026"), null);   // l'ultima non e' valida
});

test("parseEventDate returns a local Date", () => {
  const d = util.parseEventDate("10.12.2026 - 12.12.2026");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 11);
  assert.equal(d.getDate(), 12);
  assert.equal(util.parseEventDate("31.02.2026"), null);
});

test("romeToday uses Europe/Rome, not the machine time zone", () => {
  // 25 ottobre 2026: Roma e' gia' in ora solare (CET, UTC+1) -> 22:30 UTC = 23:30 del 25
  assert.deepEqual(util.romeToday(new Date("2026-10-25T22:30:00Z")), { y: 2026, m: 10, d: 25 });
  // 23:30 UTC = 00:30 del 26 a Roma
  assert.deepEqual(util.romeToday(new Date("2026-10-25T23:30:00Z")), { y: 2026, m: 10, d: 26 });
  // estate (CEST, UTC+2): 22:30 UTC del 15 luglio = 00:30 del 16
  assert.deepEqual(util.romeToday(new Date("2026-07-15T22:30:00Z")), { y: 2026, m: 7, d: 16 });
  assert.deepEqual(util.romeToday(new Date("2026-07-15T21:30:00Z")), { y: 2026, m: 7, d: 15 });
});

test("isPastEvent: end of day in Europe/Rome", () => {
  const noon = new Date("2026-10-25T12:00:00Z");
  assert.equal(util.isPastEvent("12.01.2026", noon), true);
  assert.equal(util.isPastEvent("24.10.2026", noon), true);
  assert.equal(util.isPastEvent("25.10.2026", noon), false);       // oggi: ancora visibile
  assert.equal(util.isPastEvent("30.11.2026", noon), false);
  // a mezzanotte e mezza (Roma) del 26 l'evento del 25 e' passato; alle 23:30 del 25 no
  assert.equal(util.isPastEvent("25.10.2026", new Date("2026-10-25T22:30:00Z")), false);
  assert.equal(util.isPastEvent("25.10.2026", new Date("2026-10-25T23:30:00Z")), true);
  // intervallo: passato solo dopo l'ULTIMO giorno
  assert.equal(util.isPastEvent("10.12.2026 - 12.12.2026", new Date("2026-12-11T12:00:00Z")), false);
  assert.equal(util.isPastEvent("10.12.2026 - 12.12.2026", new Date("2026-12-13T12:00:00Z")), true);
  // ISO e dd/mm/yyyy
  assert.equal(util.isPastEvent("2026-01-05", noon), true);
  assert.equal(util.isPastEvent("05/01/2026", noon), true);
  assert.equal(util.isPastEvent("2027-01-05", noon), false);
});

test("isPastEvent: unparseable non-empty date keeps the event visible and warns once", () => {
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => warns.push(a.join(" "));
  try {
    assert.equal(util.isPastEvent("da definire", new Date()), false);
    assert.equal(util.isPastEvent("da definire", new Date()), false);
    assert.equal(util.isPastEvent("31.02.2026", new Date()), false);
    assert.equal(util.isPastEvent("", new Date()), false);
    assert.equal(util.isPastEvent("-", new Date()), false);
    assert.equal(util.isPastEvent(undefined, new Date()), false);
  } finally {
    console.warn = orig;
  }
  assert.equal(warns.length, 2, warns.join(" | "));
  assert.match(warns[0], /da definire/);
  assert.match(warns[1], /31\.02\.2026/);
});

test("isSoldFlag normalises accents/case", () => {
  for (const v of ["si", "Sì", " SI ", "yes", "Sold", "venduto"]) assert.equal(util.isSoldFlag(v), true, v);
  for (const v of ["", "no", "-", null, undefined]) assert.equal(util.isSoldFlag(v), false, String(v));
});

test("escapeHtml and isValidId", () => {
  assert.equal(util.escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  assert.equal(util.isValidId("v1"), true);
  assert.equal(util.isValidId("gc-50"), true);
  assert.equal(util.isValidId("mc:1"), false);
  assert.equal(util.isValidId(""), false);
  assert.equal(util.isValidId('v1"><x'), false);
});

test("pickLangField falls back it -> en -> ru and ignores '-'", () => {
  const o = { name_it: "Uno", name_en: "-", name_ru: "Один", short_it: "-", short_en: "e" };
  assert.equal(util.pickLangField(o, "name", "it"), "Uno");
  assert.equal(util.pickLangField(o, "name", "en"), "Uno");
  assert.equal(util.pickLangField(o, "name", "ru"), "Один");
  assert.equal(util.pickLangField(o, "short", "it"), "e");
  assert.equal(util.pickLangField({}, "name", "it"), "");
});

test("product registry: one cleanup rule per source, sold override survives re-registration", () => {
  const reg = () => globalThis.CD.shop.products;
  util.registerProduct("catalogue", { id: "v1", type: "physical", priceCents: 100 });
  util.registerProduct("masterclass", { id: "mc1", type: "digital", priceCents: 100 });
  util.registerProduct("certificati", { id: "gc-1", type: "digital", priceCents: 100 });
  util.clearProducts("catalogue");
  assert.deepEqual(Object.keys(reg()).sort(), ["gc-1", "mc1"]);
  util.markSold("mc1");
  assert.equal(reg().mc1.sold, true);
  util.clearProducts("masterclass");
  assert.equal(util.registerProduct("masterclass", { id: "mc1", type: "digital", priceCents: 100, sold: false }).sold, true);
  assert.equal(util.isSoldOverride("mc1"), true);
  assert.equal(util.isSoldOverride("gc-1"), false);
});

test("warnBadPrice only logs non-empty unparseable prices of unsold items", () => {
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a);
  try {
    util.warnBadPrice("CATALOGUE", "v1", { price_new: "12abc" }, "price_new", null, false);
    util.warnBadPrice("CATALOGUE", "v2", { price_new: "-" }, "price_new", null, false);
    util.warnBadPrice("CATALOGUE", "v3", { price_new: "" }, "price_new", null, false);
    util.warnBadPrice("CATALOGUE", "v4", { price_new: "12abc" }, "price_new", null, true);
    util.warnBadPrice("CATALOGUE", "v5", { price_new: "120" }, "price_new", 12000, false);
  } finally {
    console.error = orig;
  }
  assert.equal(errs.length, 1);
  assert.match(errs[0][0], /\[CATALOGUE\] prezzo non valido/);
  assert.equal(errs[0][1], "v1");
});
