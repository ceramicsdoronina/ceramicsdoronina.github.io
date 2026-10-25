// test/money.test.js  -  esegui con: node --test test/money.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseEuroToCents, cellToCents } = require("../Stripe/js/money.js");
const util = require("../Stripe/js/util.js");

test("parseEuroToCents table", () => {
  const table = [
    ["120", 12000], ["120€", 12000], ["€ 120", 12000], ["120 EUR", 12000], [" 120 € ", 12000],
    ["120,5", 12050], ["120,50", 12050], ["120.50", 12050], ["0,99", 99], ["0.05", 5],
    ["1.234,56", 123456], ["1,234.56", 123456], ["1.234", 123400], ["1,234", 123400],
    ["12.345.678", null], // oltre il limite di 1e7 centesimi
    [120, 12000], [120.5, 12050], [0.01, 1], [99999.99, 9999999],
    ["", null], ["-", null], [null, null], [undefined, null], [{}, null],
    ["-5", null], ["abc", null], ["12abc", null], ["1e3", null], ["NaN", null],
    ["0", null], ["0,00", null], [0, null], [-3, null], [NaN, null], [Infinity, null],
    ["1.5.5", null], ["12,34,56", null], ["100.", null], [".5", null], [",50", null],
    ["100001", null], ["100000", 10000000], ["100000,01", null],
  ];
  for (const [input, expected] of table) {
    assert.equal(parseEuroToCents(input), expected, `input ${JSON.stringify(input)}`);
  }
});

test("cellToCents prefers raw numeric value", () => {
  assert.equal(cellToCents({ price_new: "120 €", price_new__raw: 120 }, "price_new"), 12000);
  assert.equal(cellToCents({ price_new: "120,50" }, "price_new"), 12050);
  assert.equal(cellToCents({ price_new: "-" }, "price_new"), null);
  assert.equal(cellToCents(null, "x"), null);
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

test("isPastEvent", () => {
  const now = new Date(2026, 9, 25);
  assert.equal(util.isPastEvent("12.01.2026", now), true);
  assert.equal(util.isPastEvent("25.10.2026", now), false);
  assert.equal(util.isPastEvent("30.11.2026", now), false);
  assert.equal(util.isPastEvent("da definire", now), false);
});
